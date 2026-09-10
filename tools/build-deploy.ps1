$ErrorActionPreference = "Stop"

$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$portfolioRoot = Split-Path $webRoot -Parent
$aboutSourceRoot = Join-Path $portfolioRoot "About"
$stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $webRoot ".deploy"))
$expectedStagingRoot = [System.IO.Path]::GetFullPath((Join-Path $webRoot ".deploy"))
$syncScript = Join-Path $PSScriptRoot "sync-content.ps1"
$metadataTest = Join-Path $PSScriptRoot "test-content-metadata.ps1"
$gifMetadataTest = Join-Path $PSScriptRoot "test-gif-metadata.ps1"
$mediaLoadingTest = Join-Path $PSScriptRoot "test-media-loading.ps1"
$imageExtensions = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif")
$aboutAssetExtensions = $imageExtensions + @(".docx")
$forbiddenReleaseExtensions = @(".mp4", ".webm")

if (-not $stagingRoot.Equals($expectedStagingRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Deployment staging path is not the expected Web/.deploy folder."
}

& $metadataTest
& $gifMetadataTest
& $mediaLoadingTest
& $syncScript

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

function Copy-ReleaseItem {
  param([string]$RelativePath)

  $source = Join-Path $webRoot $RelativePath
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Release source is missing: $RelativePath"
  }

  $destination = Join-Path $stagingRoot $RelativePath
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
}

Copy-ReleaseItem "index.html"
Copy-ReleaseItem "robots.txt"
Copy-ReleaseItem "styles"
Copy-ReleaseItem "scripts"
Copy-ReleaseItem "assets\library"
Copy-ReleaseItem "assets\header-carousel"

# About is a source folder outside Web. Release its browser assets and resumes.
if (Test-Path -LiteralPath $aboutSourceRoot -PathType Container) {
  Get-ChildItem -LiteralPath $aboutSourceRoot -File -Recurse -Force |
    Where-Object { $aboutAssetExtensions -contains $_.Extension.ToLowerInvariant() } |
    ForEach-Object {
      $relativePath = $_.FullName.Substring($aboutSourceRoot.Length + 1)
      $destination = Join-Path $stagingRoot (Join-Path "assets\about" $relativePath)
      New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
      Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
    }
}

$forbiddenReleaseFiles = @(Get-ChildItem -LiteralPath $stagingRoot -File -Recurse -Force |
  Where-Object {
    $forbiddenReleaseExtensions -contains $_.Extension.ToLowerInvariant() -or
    $_.FullName -match "[\\/]_VIDEO[\\/]"
  })
if ($forbiddenReleaseFiles.Count -gt 0) {
  $forbiddenPaths = ($forbiddenReleaseFiles | Select-Object -ExpandProperty FullName) -join [Environment]::NewLine
  throw "Deployment package contains forbidden source video content:$([Environment]::NewLine)$forbiddenPaths"
}

$releaseFileCount = @(Get-ChildItem -LiteralPath $stagingRoot -File -Recurse -Force).Count
Write-Output "Clean deployment package prepared: $releaseFileCount files."
