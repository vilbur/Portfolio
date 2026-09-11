$ErrorActionPreference = "Stop"
$toolsRoot = (Resolve-Path $PSScriptRoot).Path
. (Join-Path $toolsRoot "gif-metadata.ps1")

$videoCases = @(
  @{
    Name = "Galerie Edison - tAJ-1rcjf-8&t=4s.gif"
    Expected = "https://www.youtube.com/watch?v=tAJ-1rcjf-8&t=4s"
  },
  @{
    Name = "Vila Lignum - Crjribz7aOU.gif"
    Expected = "https://www.youtube.com/watch?v=Crjribz7aOU"
  },
  @{
    Name = "Crib - 6vY3X06milo&t=4s.gif"
    Expected = "https://www.youtube.com/watch?v=6vY3X06milo&t=4s"
  }
)

foreach ($case in $videoCases) {
  $actual = (Get-GifMetadata -Path $case.Name).VideoUrl
  if ($actual -ne $case.Expected) {
    throw "GIF filename '$($case.Name)' resolved to '$actual' instead of '$($case.Expected)'."
  }
}

$imageCases = @(
  "ordinary-gallery-image.gif",
  "Almost - too-short.gif",
  "No separator tAJ-1rcjf-8.gif"
)

foreach ($name in $imageCases) {
  if ($null -ne (Get-GifMetadata -Path $name).VideoUrl) {
    throw "Ordinary GIF filename '$name' was incorrectly classified as video."
  }
}

Write-Output "GIF filename tests passed: YouTube suffix detection and ordinary GIF behavior."
