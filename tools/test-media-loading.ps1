$ErrorActionPreference = "Stop"
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$mainScript = [System.IO.File]::ReadAllText((Join-Path $webRoot "scripts\main.js"))
$mainStyles = [System.IO.File]::ReadAllText((Join-Path $webRoot "styles\main.css"))

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

if ($mainScript -notmatch 'embedUrl\.searchParams\.set\("mute",\s*"1"\)') {
  throw "YouTube embeds must always start muted."
}

if (
  $mainScript -notmatch 'className\s*=\s*"video-loading"' -or
  $mainScript -notmatch 'frame\.addEventListener\("load"' -or
  $mainScript -notmatch 'loadingIndicator\.hidden\s*=\s*true' -or
  $mainStyles -notmatch '\.video-loading\[hidden\]\s*\{\s*display:\s*none;'
) {
  throw "YouTube embeds must show a loading indicator until the player loads."
}

Write-Output "Media loading tests passed: lazy thumbnails, adjacent preloads and muted deferred YouTube embeds with loading feedback."
