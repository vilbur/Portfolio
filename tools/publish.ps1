param(
  [switch]$CheckOnly,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildScript = Join-Path $PSScriptRoot "build-deploy.ps1"
$stagingRoot = Join-Path $webRoot ".deploy"
$firebaseConfigPath = Join-Path $webRoot ".firebaserc"
$firebaseHostingConfigPath = Join-Path $webRoot "firebase.json"
$script:firebaseMode = $null
$script:firebaseCommand = $null
$script:firebaseNodeBin = $null
$script:firebaseLastExitCode = 0

function Assert-GeneratedSite {
  param([string]$SiteRoot)

  $siteRootFullPath = [System.IO.Path]::GetFullPath($SiteRoot).TrimEnd("\", "/")
  $siteRootPrefix = $siteRootFullPath + [System.IO.Path]::DirectorySeparatorChar
  $requiredFiles = @(
    "index.html",
    "styles/main.css",
    "scripts/image-catalog.js",
    "scripts/header-carousel.js",
    "scripts/projects.js",
    "scripts/main.js"
  )

  foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $siteRootFullPath $relativePath))) {
      throw "Required website file is missing: $relativePath"
    }
  }

  $catalogPath = Join-Path $siteRootFullPath "scripts\image-catalog.js"
  $catalogContent = [System.IO.File]::ReadAllText($catalogPath)
  if ($catalogContent -notmatch "window\.PORTFOLIO_FOLDER_METADATA\s*=") {
    throw "Folder metadata is missing from the generated catalog."
  }
  foreach ($folderField in @("markdown", "url")) {
    if ($catalogContent -notmatch ("\b" + [regex]::Escape($folderField) + "\s*:")) {
      throw "The generated folder metadata does not contain the '$folderField' field."
    }
  }
  foreach ($catalogField in @("format", "type", "version", "title", "description", "thumbnail")) {
    if ($catalogContent -notmatch ("\b" + [regex]::Escape($catalogField) + "\s*:")) {
      throw "The generated catalog does not contain the '$catalogField' field required by the new website."
    }
  }

  $mediaMatches = [regex]::Matches($catalogContent, 'path: "([^"]+)"')
  if ($mediaMatches.Count -eq 0) {
    throw "The generated gallery is empty. Nothing will be published."
  }

  $catalogPaths = New-Object "System.Collections.Generic.HashSet[string]" (
    [System.StringComparer]::OrdinalIgnoreCase
  )
  foreach ($mediaMatch in $mediaMatches) {
    $catalogPathValue = $mediaMatch.Groups[1].Value
    if (-not $catalogPaths.Add($catalogPathValue)) {
      throw "Generated catalog contains a duplicate media path: $catalogPathValue"
    }
    $relativeMediaPath = $catalogPathValue.Replace("/", "\")
    $absoluteMediaPath = [System.IO.Path]::GetFullPath((Join-Path $siteRootFullPath $relativeMediaPath))
    if (-not $absoluteMediaPath.StartsWith($siteRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Generated media path leaves the website folder: $relativeMediaPath"
    }
    if (-not (Test-Path -LiteralPath $absoluteMediaPath -PathType Leaf)) {
      throw "Generated media file is missing: $relativeMediaPath"
    }
  }

  $headerCatalogPath = Join-Path $siteRootFullPath "scripts\header-carousel.js"
  $headerCatalogContent = [System.IO.File]::ReadAllText($headerCatalogPath)
  foreach ($headerField in @("path", "version", "title", "description")) {
    if ($headerCatalogContent -notmatch ("\b" + [regex]::Escape($headerField) + "\s*:")) {
      throw "The header catalog does not contain the '$headerField' field required by the new website."
    }
  }
  $headerMatches = [regex]::Matches($headerCatalogContent, 'path: "([^"]+)"')
  if ($headerMatches.Count -eq 0) {
    throw "The generated header carousel is empty."
  }
  foreach ($headerMatch in $headerMatches) {
    $relativeHeaderPath = $headerMatch.Groups[1].Value.Replace("/", "\")
    $absoluteHeaderPath = [System.IO.Path]::GetFullPath((Join-Path $siteRootFullPath $relativeHeaderPath))
    if (-not $absoluteHeaderPath.StartsWith($siteRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Generated header path leaves the website folder: $relativeHeaderPath"
    }
    if (-not (Test-Path -LiteralPath $absoluteHeaderPath -PathType Leaf)) {
      throw "Generated header file is missing: $relativeHeaderPath"
    }
  }

  $indexPath = Join-Path $siteRootFullPath "index.html"
  $indexContent = [System.IO.File]::ReadAllText($indexPath)
  $localReferences = [regex]::Matches($indexContent, '(?:src|href)="([^"]+)"')
  foreach ($referenceMatch in $localReferences) {
    $reference = $referenceMatch.Groups[1].Value.Trim()
    if ($reference -match '^(?:[a-z][a-z0-9+.-]*:|#|//)') { continue }

    $cleanReference = ($reference -split '[?#]', 2)[0]
    if ([string]::IsNullOrWhiteSpace($cleanReference)) { continue }
    $relativeReference = [System.Uri]::UnescapeDataString($cleanReference).Replace("/", "\")
    $absoluteReference = [System.IO.Path]::GetFullPath((Join-Path $siteRootFullPath $relativeReference))
    if (-not $absoluteReference.StartsWith($siteRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Website reference leaves the deployment package: $reference"
    }
    $referenceExists = Test-Path -LiteralPath $absoluteReference -PathType Leaf
    if (-not $referenceExists -and (Test-Path -LiteralPath $absoluteReference -PathType Container)) {
      $referenceExists = Test-Path -LiteralPath (Join-Path $absoluteReference "index.html") -PathType Leaf
    }
    if (-not $referenceExists) {
      throw "Website references a file that is not in the deployment package: $reference"
    }
  }

  return $mediaMatches.Count
}

function Initialize-FirebaseCli {
  $installedCommand = Get-Command firebase -ErrorAction SilentlyContinue
  if ($installedCommand) {
    $script:firebaseMode = "direct"
    $script:firebaseCommand = $installedCommand.Source
    return
  }

  $directCandidates = @()
  if ($env:APPDATA) {
    $directCandidates += Join-Path $env:APPDATA "npm\firebase.cmd"
  }
  foreach ($candidate in $directCandidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      $script:firebaseMode = "direct"
      $script:firebaseCommand = $candidate
      return
    }
  }

  # Codex includes a normal Node runtime that can run Firebase non-interactively.
  # This keeps the double-click workflow independent of the AI itself.
  if ($env:USERPROFILE) {
    $dependencyRoot = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
    $nodeBin = Join-Path $dependencyRoot "node\bin"
    $nodePath = Join-Path $nodeBin "node.exe"
    $pnpmCandidates = @(
      (Join-Path $dependencyRoot "bin\fallback\pnpm.cmd"),
      (Join-Path $dependencyRoot "bin\override\pnpm.cmd")
    )
    $pnpmPath = $pnpmCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if ((Test-Path -LiteralPath $nodePath -PathType Leaf) -and $pnpmPath) {
      $script:firebaseMode = "pnpm"
      $script:firebaseCommand = $pnpmPath
      $script:firebaseNodeBin = $nodeBin
      return
    }
  }

  throw "Firebase publishing runtime was not found. Install Node.js and firebase-tools, then run PUBLISH-WEB.cmd again."
}

function Invoke-FirebaseCli {
  param([string[]]$Arguments)

  if ($script:firebaseMode -eq "direct") {
    $previousErrorAction = $ErrorActionPreference
    try {
      # Windows PowerShell wraps native stderr as error records. Firebase and
      # package tools also use stderr for harmless progress messages.
      $ErrorActionPreference = "Continue"
      & $script:firebaseCommand @Arguments
      $script:firebaseLastExitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousErrorAction
    }
    return
  }

  if ($script:firebaseMode -eq "pnpm") {
    $previousPath = $env:Path
    $previousErrorAction = $ErrorActionPreference
    try {
      $env:Path = $script:firebaseNodeBin + ";" + $previousPath
      $ErrorActionPreference = "Continue"
      & $script:firebaseCommand dlx firebase-tools @Arguments
      $script:firebaseLastExitCode = $LASTEXITCODE
    } finally {
      $env:Path = $previousPath
      $ErrorActionPreference = $previousErrorAction
    }
    return
  }

  throw "Firebase publishing runtime was not initialized."
}

function Get-FileSha256 {
  param([string]$Path)

  $hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    return ([System.BitConverter]::ToString($hashAlgorithm.ComputeHash($stream))).Replace("-", "")
  } finally {
    $stream.Dispose()
    $hashAlgorithm.Dispose()
  }
}

function Assert-LiveSiteMatchesRelease {
  param(
    [string]$Url,
    [string]$ExpectedSiteRoot
  )

  $verificationFiles = @(
    [PSCustomObject]@{ RelativePath = "index.html"; LivePath = ""; CheckCache = $true },
    [PSCustomObject]@{ RelativePath = "scripts\image-catalog.js"; LivePath = "scripts/image-catalog.js"; CheckCache = $false },
    [PSCustomObject]@{ RelativePath = "scripts\header-carousel.js"; LivePath = "scripts/header-carousel.js"; CheckCache = $false }
  )
  $downloadPath = Join-Path ([System.IO.Path]::GetTempPath()) (
    "portfolio-live-file-" + [guid]::NewGuid().ToString("N")
  )
  try {
    for ($attempt = 1; $attempt -le 5; $attempt += 1) {
      $allFilesMatch = $true
      foreach ($verificationFile in $verificationFiles) {
        $expectedPath = Join-Path $ExpectedSiteRoot $verificationFile.RelativePath
        $expectedHash = Get-FileSha256 -Path $expectedPath
        $liveBaseUrl = $Url.TrimEnd("/") + "/" + $verificationFile.LivePath
        $separator = if ($liveBaseUrl.Contains("?")) { "&" } else { "?" }
        $verificationUrl = $liveBaseUrl + $separator + "deploy_verify=" +
          [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $response = Invoke-WebRequest `
          -Uri $verificationUrl `
          -OutFile $downloadPath `
          -PassThru `
          -UseBasicParsing `
          -Headers @{ "Cache-Control" = "no-cache" }
        $liveHash = Get-FileSha256 -Path $downloadPath

        if ($liveHash -ne $expectedHash) {
          $allFilesMatch = $false
          break
        }
        if ($verificationFile.CheckCache) {
          $cacheControl = [string]$response.Headers["Cache-Control"]
          if ($cacheControl -notmatch "(?i)(no-cache|no-store|max-age=0)") {
            throw "Live HTML is current, but its cache policy can still keep an old page: $cacheControl"
          }
        }
      }

      if ($allFilesMatch) {
        Write-Output "Live website verified: HTML, asset catalogs and cache policy are current."
        return
      }

      if ($attempt -lt 5) { Start-Sleep -Seconds 2 }
    }
  } finally {
    if (Test-Path -LiteralPath $downloadPath) {
      Remove-Item -LiteralPath $downloadPath -Force
    }
  }

  throw "Firebase reported success, but the live HTML or asset catalogs do not match the deployment package."
}

Write-Output "Preparing portfolio content..."
& $buildScript
$mediaCount = Assert-GeneratedSite -SiteRoot $stagingRoot
Write-Output "Website check passed: $mediaCount media files are ready."

$hostingConfig = Get-Content -Raw -LiteralPath $firebaseHostingConfigPath | ConvertFrom-Json
if ($hostingConfig.hosting.public -ne ".deploy") {
  throw "Firebase must publish only the clean .deploy package."
}
$defaultCacheRule = $hostingConfig.hosting.headers |
  Where-Object source -eq "**" |
  Select-Object -First 1
$defaultCacheControl = $defaultCacheRule.headers |
  Where-Object key -eq "Cache-Control" |
  Select-Object -First 1
if ($defaultCacheControl.value -notmatch "(?i)(no-cache|no-store|max-age=0)") {
  throw "Firebase must disable stale caching for the root HTML page."
}

if ($CheckOnly) {
  Write-Output "Check complete. Production was not changed."
  exit 0
}

$firebaseConfig = Get-Content -Raw -LiteralPath $firebaseConfigPath | ConvertFrom-Json
$projectId = $firebaseConfig.projects.default
if ([string]::IsNullOrWhiteSpace($projectId)) {
  throw "Firebase project is not configured in .firebaserc."
}

Initialize-FirebaseCli
$loginOutput = (Invoke-FirebaseCli -Arguments @("login:list") 2>&1 | Out-String)
if ($script:firebaseLastExitCode -ne 0 -or $loginOutput -match "No authorized accounts") {
  Write-Output "A one-time Google sign-in is required before the first publication."
  Invoke-FirebaseCli -Arguments @("login")
  if ($script:firebaseLastExitCode -ne 0) {
    throw "Firebase sign-in was not completed."
  }
}

$deployMessage = "Portfolio content update " + (Get-Date -Format "yyyy-MM-dd HH:mm")
Write-Output "Publishing the verified website to Firebase..."
Push-Location $webRoot
try {
  Invoke-FirebaseCli -Arguments @(
    "deploy",
    "--only", "hosting",
    "--project", $projectId,
    "--non-interactive",
    "-m", $deployMessage
  )
  if ($script:firebaseLastExitCode -ne 0) {
    throw "Firebase did not complete the publication."
  }
} finally {
  Pop-Location
}

$hostingUrl = "https://$projectId.web.app"
Assert-LiveSiteMatchesRelease -Url $hostingUrl -ExpectedSiteRoot $stagingRoot
Write-Output "Published successfully: $hostingUrl"
if (-not $NoBrowser) {
  Start-Process $hostingUrl
}
