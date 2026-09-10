$ErrorActionPreference = "Stop"
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$mainScript = [System.IO.File]::ReadAllText((Join-Path $webRoot "scripts\main.js"))

if ($mainScript -notmatch 'image\.loading\s*=\s*isLightboxMedia\s*\?\s*"eager"\s*:\s*"lazy"') {
  throw "Gallery thumbnails must use native lazy loading outside the lightbox."
}

if (
  $mainScript -notmatch 'preloadProject\(previous\)' -or
  $mainScript -notmatch 'preloadProject\(next\)' -or
  $mainScript -match 'visibleProjects\.forEach\([^)]*preloadProject'
) {
  throw "Lightbox preloading must stay limited to the previous and next items."
}

if (
  $mainScript -notmatch 'isLightboxMedia\s*&&\s*project\.mediaType\s*===\s*"video"\s*&&\s*project\.videoUrl' -or
  $mainScript -notmatch 'document\.createElement\("iframe"\)' -or
  $mainScript -notmatch 'youtube-nocookie\.com/embed/'
) {
  throw "YouTube embeds must be created only for an opened lightbox video."
}

Write-Output "Media loading tests passed: lazy thumbnails, adjacent preloads and deferred YouTube embeds."
