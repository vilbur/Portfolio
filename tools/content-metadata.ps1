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
    $contentFile = Get-ChildItem -LiteralPath $_.FullName -File -Force |
      Where-Object Name -ieq "content.md" |
      Select-Object -First 1
    $markdown = if ($contentFile) {
      [System.IO.File]::ReadAllText($contentFile.FullName, [System.Text.Encoding]::UTF8).Trim()
    } else {
      $null
    }
    $url = Get-ValidFolderUrl -FolderPath $_.FullName

    if (-not [string]::IsNullOrWhiteSpace($markdown) -or $url) {
      [PSCustomObject]@{
        Path = $_.FullName.Substring($rootFullPath.Length + 1).Replace("\", "/")
        Markdown = if ([string]::IsNullOrWhiteSpace($markdown)) { $null } else { $markdown }
        Url = $url
      }
    }
  })
}
