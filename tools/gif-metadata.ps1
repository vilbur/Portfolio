function Get-YouTubeUrlFromGifFileName {
  param([string]$Path)

  $name = [System.IO.Path]::GetFileNameWithoutExtension($Path)
  $match = [regex]::Match(
    $name,
    '(?:\s+-\s+)(?<videoId>[A-Za-z0-9_-]{11})(?<parameters>(?:&[A-Za-z][A-Za-z0-9_-]*=[^&\s]+)*)$'
  )
  if (-not $match.Success) { return $null }

  return 'https://www.youtube.com/watch?v=' +
    $match.Groups['videoId'].Value +
    $match.Groups['parameters'].Value
}

function Get-GifMetadata {
  param([string]$Path)

  return [PSCustomObject]@{
    Title = $null
    Description = $null
    Thumbnail = 'cover'
    VideoUrl = Get-YouTubeUrlFromGifFileName -Path $Path
  }
}
