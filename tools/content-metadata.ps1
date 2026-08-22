function Get-ValidFolderUrl {
  param([string]$FolderPath)

  $shortcutFiles = Get-ChildItem -LiteralPath $FolderPath -File -Force |
    Where-Object Extension -ieq ".url" |
    Sort-Object Name

  foreach ($shortcutFile in $shortcutFiles) {
    $urlLine = Get-Content -LiteralPath $shortcutFile.FullName -ErrorAction SilentlyContinue |
      Where-Object { $_ -match "^\s*URL\s*=\s*(.+?)\s*$" } |
      Select-Object -First 1
    if (-not $urlLine) { continue }

    $urlValue = ([regex]::Match($urlLine, "^\s*URL\s*=\s*(.+?)\s*$")).Groups[1].Value.Trim()
    $parsedUrl = $null
    if (
      [System.Uri]::TryCreate($urlValue, [System.UriKind]::Absolute, [ref]$parsedUrl) -and
      $parsedUrl.Scheme -in @("http", "https")
    ) {
      return $parsedUrl.AbsoluteUri
    }
  }

  return $null
}

function Get-FolderMetadataRecords {
  param([string]$RootPath)

  if (-not (Test-Path -LiteralPath $RootPath -PathType Container)) { return @() }

  $rootFullPath = [System.IO.Path]::GetFullPath($RootPath).TrimEnd("\", "/")
  $folders = Get-ChildItem -LiteralPath $rootFullPath -Directory -Recurse -Force | Sort-Object FullName

  return @($folders | ForEach-Object {
    $contentFiles = @(Get-ChildItem -LiteralPath $_.FullName -File -Force)
    $legacyContentFile = $contentFiles | Where-Object Name -ieq "content.md" | Select-Object -First 1
    $englishContentFile = $contentFiles | Where-Object Name -ieq "content.en.md" | Select-Object -First 1
    $czechContentFile = $contentFiles |
      Where-Object { $_.Name -ieq "content.cs.md" -or $_.Name -ieq "content.cz.md" } |
      Sort-Object @{ Expression = { if ($_.Name -ieq "content.cs.md") { 0 } else { 1 } } } |
      Select-Object -First 1

    $readMarkdown = {
      param($ContentFile)
      if (-not $ContentFile) { return $null }
      $value = [System.IO.File]::ReadAllText($ContentFile.FullName, [System.Text.Encoding]::UTF8).Trim()
      if ([string]::IsNullOrWhiteSpace($value)) { return $null }
      return $value
    }
    $legacyMarkdown = & $readMarkdown $legacyContentFile
    $englishMarkdown = & $readMarkdown $englishContentFile
    $czechMarkdown = & $readMarkdown $czechContentFile
    if (-not $englishMarkdown) { $englishMarkdown = $legacyMarkdown }
    if (-not $czechMarkdown) { $czechMarkdown = $legacyMarkdown }
    $url = Get-ValidFolderUrl -FolderPath $_.FullName

    if ($englishMarkdown -or $czechMarkdown -or $url) {
      [PSCustomObject]@{
        Path = $_.FullName.Substring($rootFullPath.Length + 1).Replace("\", "/")
        Markdown = [PSCustomObject]@{
          en = $englishMarkdown
          cs = $czechMarkdown
        }
        Url = $url
      }
    }
  })
}

function Get-ThumbnailInstruction {
  param([string]$SpecialInstructions)

  if ([string]::IsNullOrWhiteSpace($SpecialInstructions)) { return "cover" }

  $instructionMatches = [regex]::Matches(
    $SpecialInstructions,
    '(?i)(?<![\p{L}\p{N}_-])thumbnail\s*=\s*([a-z][a-z0-9_-]*)'
  )
  foreach ($instructionMatch in $instructionMatches) {
    $value = $instructionMatch.Groups[1].Value.Trim().ToLowerInvariant()
    if ($value -in @("contain", "cover", "top", "center", "bottom")) {
      return $value
    }
  }

  return "cover"
}

function Get-IptcDatasetText {
  param(
    [string]$Path,
    [byte]$Record,
    [byte]$Dataset
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  $jpegBytes = [System.IO.File]::ReadAllBytes($Path)
  if ($jpegBytes.Length -lt 4 -or $jpegBytes[0] -ne 0xFF -or $jpegBytes[1] -ne 0xD8) {
    return $null
  }

  $values = New-Object "System.Collections.Generic.List[string]"
  $offset = 2
  while ($offset + 3 -lt $jpegBytes.Length) {
    while ($offset -lt $jpegBytes.Length -and $jpegBytes[$offset] -eq 0xFF) { $offset += 1 }
    if ($offset -ge $jpegBytes.Length) { break }

    $marker = $jpegBytes[$offset]
    $offset += 1
    if ($marker -in @(0xD9, 0xDA)) { break }
    if ($marker -eq 0x01 -or ($marker -ge 0xD0 -and $marker -le 0xD7)) { continue }
    if ($offset + 1 -ge $jpegBytes.Length) { break }

    $segmentLength = ([int]$jpegBytes[$offset] * 256) + [int]$jpegBytes[$offset + 1]
    if ($segmentLength -lt 2) { break }
    $segmentStart = $offset + 2
    $segmentEnd = $segmentStart + $segmentLength - 2
    if ($segmentEnd -gt $jpegBytes.Length) { break }

    if ($marker -eq 0xED) {
      for ($index = $segmentStart; $index + 4 -lt $segmentEnd; $index += 1) {
        if (
          $jpegBytes[$index] -ne 0x1C -or
          $jpegBytes[$index + 1] -ne $Record -or
          $jpegBytes[$index + 2] -ne $Dataset
        ) { continue }

        $lengthDescriptor = ([int]$jpegBytes[$index + 3] * 256) + [int]$jpegBytes[$index + 4]
        $valueStart = $index + 5
        if (($lengthDescriptor -band 0x8000) -ne 0) {
          $lengthByteCount = $lengthDescriptor -band 0x7FFF
          if ($lengthByteCount -lt 1 -or $lengthByteCount -gt 4 -or $valueStart + $lengthByteCount -gt $segmentEnd) {
            continue
          }
          $valueLength = 0
          for ($lengthIndex = 0; $lengthIndex -lt $lengthByteCount; $lengthIndex += 1) {
            $valueLength = ($valueLength * 256) + [int]$jpegBytes[$valueStart + $lengthIndex]
          }
          $valueStart += $lengthByteCount
        } else {
          $valueLength = $lengthDescriptor
        }

        if ($valueLength -lt 1 -or $valueStart + $valueLength -gt $segmentEnd) { continue }
        $valueBytes = New-Object byte[] $valueLength
        [System.Array]::Copy($jpegBytes, $valueStart, $valueBytes, 0, $valueLength)
        try {
          $value = (New-Object System.Text.UTF8Encoding($false, $true)).GetString($valueBytes)
        } catch {
          $value = [System.Text.Encoding]::GetEncoding(1252).GetString($valueBytes)
        }
        $value = $value.Trim([char]0).Trim()
        if (-not [string]::IsNullOrWhiteSpace($value)) { $values.Add($value) }
        $index = $valueStart + $valueLength - 1
      }
    }

    $offset = $segmentEnd
  }

  if ($values.Count -eq 0) { return $null }
  return $values -join "; "
}
