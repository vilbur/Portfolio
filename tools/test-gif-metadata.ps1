$ErrorActionPreference = "Stop"
$toolsRoot = (Resolve-Path $PSScriptRoot).Path
. (Join-Path $toolsRoot "gif-metadata.ps1")

$fixturePath = Join-Path ([System.IO.Path]::GetTempPath()) ("portfolio-gif-comment-" + [guid]::NewGuid().ToString("N") + ".gif")
$plainFixturePath = Join-Path ([System.IO.Path]::GetTempPath()) ("portfolio-gif-plain-" + [guid]::NewGuid().ToString("N") + ".gif")

try {
  $plainGif = [Convert]::FromBase64String("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
  [System.IO.File]::WriteAllBytes($plainFixturePath, $plainGif)

  $commentText = "Video URL: https://youtu.be/dQw4w9WgXcQ?t=42"
  $commentBytes = [System.Text.Encoding]::UTF8.GetBytes($commentText)
  $gifWithComment = New-Object "System.Collections.Generic.List[byte]"
  $gifWithComment.AddRange([byte[]]$plainGif[0..($plainGif.Length - 2)])
  $gifWithComment.AddRange([byte[]]@(0x21, 0xFE, [byte]$commentBytes.Length))
  $gifWithComment.AddRange([byte[]]$commentBytes)
  $gifWithComment.Add(0x00)
  $gifWithComment.Add(0x3B)
  [System.IO.File]::WriteAllBytes($fixturePath, $gifWithComment.ToArray())

  $metadata = Get-GifMetadata -Path $fixturePath
  if ($metadata.VideoUrl -ne "https://youtu.be/dQw4w9WgXcQ?t=42") {
    throw "GIF comment URL was not normalized into VideoUrl."
  }

  $plainMetadata = Get-GifMetadata -Path $plainFixturePath
  if ($null -ne $plainMetadata.VideoUrl) {
    throw "A plain GIF without a video URL was incorrectly classified as video metadata."
  }

  if ((Get-VideoUrlFromText -Text "not a URL") -ne $null) {
    throw "Invalid GIF comment text was accepted as a video URL."
  }
  if ((Get-VideoUrlFromText -Text "https://example.com/not-a-video") -ne $null) {
    throw "A non-YouTube URL was accepted as a video URL."
  }
} finally {
  if (Test-Path -LiteralPath $fixturePath) { Remove-Item -LiteralPath $fixturePath -Force }
  if (Test-Path -LiteralPath $plainFixturePath) { Remove-Item -LiteralPath $plainFixturePath -Force }
}

Write-Output "GIF metadata tests passed: URL comments and plain GIF fallback."
