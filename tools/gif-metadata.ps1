function Convert-GifMetadataBytesToText {
  param([byte[]]$Bytes)

  if (-not $Bytes -or $Bytes.Length -eq 0) { return $null }

  $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
  try {
    return $strictUtf8.GetString($Bytes).Trim([char]0).Trim()
  } catch {
    return [System.Text.Encoding]::GetEncoding(1252).GetString($Bytes).Trim([char]0).Trim()
  }
}

function Get-VideoUrlFromText {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }

  foreach ($match in [regex]::Matches($Text, 'https?://[^\s<>"'']+', 'IgnoreCase')) {
    $candidate = $match.Value.TrimEnd('.', ',', ';', ')', ']', '}')
    $uri = $null
    if (
      [System.Uri]::TryCreate($candidate, [System.UriKind]::Absolute, [ref]$uri) -and
      $uri.Scheme -in @('http', 'https')
    ) {
      $videoHost = $uri.DnsSafeHost.ToLowerInvariant()
      if ($videoHost.StartsWith("www.")) { $videoHost = $videoHost.Substring(4) }
      if ($videoHost -in @("youtu.be", "youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com")) {
        return $uri.AbsoluteUri
      }
    }
  }

  return $null
}

function Get-GifCommentText {
  param([string]$Path)

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 13) { return $null }

  $signature = [System.Text.Encoding]::ASCII.GetString($bytes, 0, 6)
  if ($signature -notin @('GIF87a', 'GIF89a')) { return $null }

  $position = 13
  $packedFields = $bytes[10]
  if (($packedFields -band 0x80) -ne 0) {
    $position += 3 * [math]::Pow(2, (($packedFields -band 0x07) + 1))
  }

  $comments = New-Object 'System.Collections.Generic.List[string]'

  function Read-GifSubBlocks {
    param(
      [ref]$Position,
      [bool]$Capture
    )

    $payload = New-Object 'System.Collections.Generic.List[byte]'
    while ($Position.Value -lt $bytes.Length) {
      $blockLength = [int]$bytes[$Position.Value]
      $Position.Value++
      if ($blockLength -eq 0) { break }
      if ($Position.Value + $blockLength -gt $bytes.Length) {
        $Position.Value = $bytes.Length
        break
      }
      if ($Capture) {
        $payload.AddRange([byte[]]$bytes[$Position.Value..($Position.Value + $blockLength - 1)])
      }
      $Position.Value += $blockLength
    }
    return $payload.ToArray()
  }

  while ($position -lt $bytes.Length) {
    $marker = $bytes[$position]
    $position++

    if ($marker -eq 0x3B) { break }

    if ($marker -eq 0x21) {
      if ($position -ge $bytes.Length) { break }
      $extensionType = $bytes[$position]
      $position++
      $payload = Read-GifSubBlocks -Position ([ref]$position) -Capture ($extensionType -eq 0xFE)
      if ($extensionType -eq 0xFE -and $payload.Length -gt 0) {
        $comment = Convert-GifMetadataBytesToText -Bytes $payload
        if (-not [string]::IsNullOrWhiteSpace($comment)) { $comments.Add($comment) }
      }
      continue
    }

    if ($marker -eq 0x2C) {
      if ($position + 9 -gt $bytes.Length) { break }
      $imagePackedFields = $bytes[$position + 8]
      $position += 9
      if (($imagePackedFields -band 0x80) -ne 0) {
        $position += 3 * [math]::Pow(2, (($imagePackedFields -band 0x07) + 1))
      }
      if ($position -ge $bytes.Length) { break }
      $position++ # LZW minimum code size
      [void](Read-GifSubBlocks -Position ([ref]$position) -Capture $false)
      continue
    }

    break
  }

  if ($comments.Count -eq 0) { return $null }
  return ($comments -join [Environment]::NewLine)
}

function Get-GifMetadata {
  param([string]$Path)

  $comment = Get-GifCommentText -Path $Path
  return [PSCustomObject]@{
    Title = $null
    Description = $null
    Thumbnail = 'cover'
    VideoUrl = Get-VideoUrlFromText -Text $comment
  }
}
