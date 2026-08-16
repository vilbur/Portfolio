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
  foreach ($catalogField in @("format", "type", "version", "title", "description")) {
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
    & $script:firebaseCommand @Arguments
    $script:firebaseLastExitCode = $LASTEXITCODE
    return
  }

  if ($script:firebaseMode -eq "pnpm") {
    $previousPath = $env:Path
    try {
      $env:Path = $script:firebaseNodeBin + ";" + $previousPath
      & $script:firebaseCommand dlx firebase-tools @Arguments
      $script:firebaseLastExitCode = $LASTEXITCODE
    } finally {
      $env:Path = $previousPath
    }
    return
  }

  throw "Firebase publishing runtime was not initialized."
}

Write-Output "Preparing portfolio content..."
& $buildScript
$mediaCount = Assert-GeneratedSite -SiteRoot $stagingRoot
Write-Output "Website check passed: $mediaCount media files are ready."

$hostingConfig = Get-Content -Raw -LiteralPath $firebaseHostingConfigPath | ConvertFrom-Json
if ($hostingConfig.hosting.public -ne ".deploy") {
  throw "Firebase must publish only the clean .deploy package."
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
Write-Output "Published successfully: $hostingUrl"
if (-not $NoBrowser) {
  Start-Process $hostingUrl
}
