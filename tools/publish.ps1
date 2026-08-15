param(
  [switch]$CheckOnly,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$syncScript = Join-Path $PSScriptRoot "sync-content.ps1"
$catalogPath = Join-Path $webRoot "scripts\image-catalog.js"
$firebaseConfigPath = Join-Path $webRoot ".firebaserc"
$localFirebasePath = Join-Path $PSScriptRoot "bin\firebase.exe"
$firebaseDownloadUrl = "https://firebase.tools/bin/win/instant/latest"

function Assert-GeneratedSite {
  $requiredFiles = @(
    "index.html",
    "styles/main.css",
    "scripts/image-catalog.js",
    "scripts/header-carousel.js",
    "scripts/projects.js",
    "scripts/main.js",
    "firebase.json",
    ".firebaserc"
  )

  foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $webRoot $relativePath))) {
      throw "Required website file is missing: $relativePath"
    }
  }

  $catalogContent = [System.IO.File]::ReadAllText($catalogPath)
  $mediaMatches = [regex]::Matches($catalogContent, 'path: "([^"]+)"')
  if ($mediaMatches.Count -eq 0) {
    throw "The generated gallery is empty. Nothing will be published."
  }

  foreach ($mediaMatch in $mediaMatches) {
    $relativeMediaPath = $mediaMatch.Groups[1].Value.Replace("/", "\")
    $absoluteMediaPath = [System.IO.Path]::GetFullPath((Join-Path $webRoot $relativeMediaPath))
    if (-not $absoluteMediaPath.StartsWith($webRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Generated media path leaves the website folder: $relativeMediaPath"
    }
    if (-not (Test-Path -LiteralPath $absoluteMediaPath -PathType Leaf)) {
      throw "Generated media file is missing: $relativeMediaPath"
    }
  }

  return $mediaMatches.Count
}

function Get-FirebaseCli {
  $installedCommand = Get-Command firebase -ErrorAction SilentlyContinue
  if ($installedCommand) {
    return $installedCommand.Source
  }

  $candidates = @($localFirebasePath)
  if ($env:APPDATA) {
    $candidates += Join-Path $env:APPDATA "npm\firebase.cmd"
  }
  if ($env:LOCALAPPDATA) {
    $candidates += Join-Path $env:LOCALAPPDATA "firebase-tools\firebase.exe"
  }

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return $candidate
    }
  }

  Write-Host "Firebase publishing tool is not installed. Downloading the official Windows version..."
  $binRoot = Split-Path $localFirebasePath -Parent
  $temporaryDownload = Join-Path $binRoot "firebase.download"
  New-Item -ItemType Directory -Force -Path $binRoot | Out-Null
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $firebaseDownloadUrl -OutFile $temporaryDownload -UseBasicParsing
    Move-Item -LiteralPath $temporaryDownload -Destination $localFirebasePath -Force
  } finally {
    if (Test-Path -LiteralPath $temporaryDownload) {
      Remove-Item -LiteralPath $temporaryDownload -Force
    }
  }
  return $localFirebasePath
}

Write-Output "Preparing portfolio content..."
& $syncScript
$mediaCount = Assert-GeneratedSite
Write-Output "Website check passed: $mediaCount media files are ready."

if ($CheckOnly) {
  Write-Output "Check complete. Production was not changed."
  exit 0
}

$firebaseConfig = Get-Content -Raw -LiteralPath $firebaseConfigPath | ConvertFrom-Json
$projectId = $firebaseConfig.projects.default
if ([string]::IsNullOrWhiteSpace($projectId)) {
  throw "Firebase project is not configured in .firebaserc."
}

$firebaseCli = Get-FirebaseCli
$loginOutput = (& $firebaseCli login:list 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $loginOutput -match "No authorized accounts") {
  Write-Output "A one-time Google sign-in is required before the first publication."
  & $firebaseCli login
  if ($LASTEXITCODE -ne 0) {
    throw "Firebase sign-in was not completed."
  }
}

$deployMessage = "Portfolio content update " + (Get-Date -Format "yyyy-MM-dd HH:mm")
Write-Output "Publishing the verified website to Firebase..."
Push-Location $webRoot
try {
  & $firebaseCli deploy --only hosting --project $projectId --non-interactive -m $deployMessage
  if ($LASTEXITCODE -ne 0) {
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
