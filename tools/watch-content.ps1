$ErrorActionPreference = "Stop"

$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sourceRoot = Join-Path (Split-Path $webRoot -Parent) "Images"
$aboutRoot = Join-Path (Split-Path $webRoot -Parent) "About"
$headerRoot = Join-Path $webRoot "assets\header-carousel"
$syncScript = Join-Path $PSScriptRoot "sync-content.ps1"

function Get-ContentFingerprint {
  $items = @($sourceRoot, $aboutRoot, $headerRoot) | ForEach-Object {
    if (Test-Path -LiteralPath $_) {
      Get-ChildItem -LiteralPath $_ -File -Recurse -Force |
        Where-Object {
          $_.Extension -match "^\.(jpg|jpeg|png|gif|bmp|webp|avif|mp4|webm|url)$" -or
          $_.Name -ieq "content.md"
        }
    }
  } | Sort-Object FullName | ForEach-Object {
    "$($_.FullName)|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)"
  }
  return $items -join "`n"
}

& $syncScript
$lastFingerprint = Get-ContentFingerprint
Write-Output "Watching gallery and header-carousel folders for content changes..."

while ($true) {
  Start-Sleep -Seconds 2
  $currentFingerprint = Get-ContentFingerprint
  if ($currentFingerprint -ne $lastFingerprint) {
    & $syncScript
    $lastFingerprint = Get-ContentFingerprint
  }
}
