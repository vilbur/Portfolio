$ErrorActionPreference = "Stop"

$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$portfolioRoot = Split-Path $webRoot -Parent
$sourceRoot = Join-Path $portfolioRoot "Images"
$destinationRoot = Join-Path $webRoot "assets\library"
$catalogPath = Join-Path $webRoot "scripts\image-catalog.js"
$headerRoot = Join-Path $webRoot "assets\header-carousel"
$headerCatalogPath = Join-Path $webRoot "scripts\header-carousel.js"

if (-not (Test-Path -LiteralPath $sourceRoot)) {
  throw "Source image folder was not found: $sourceRoot"
}

New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null
New-Item -ItemType Directory -Force -Path $headerRoot | Out-Null
Add-Type -AssemblyName System.Drawing

$sourceFiles = Get-ChildItem -LiteralPath $sourceRoot -File -Recurse -Force |
  Where-Object { $_.Extension -match "^\.(jpg|jpeg|png|gif|bmp)$" } |
  Sort-Object FullName

$records = foreach ($sourceFile in $sourceFiles) {
  $sourceRelative = $sourceFile.FullName.Substring($sourceRoot.Length + 1)
  $webRelative = if ($sourceFile.Extension -ieq ".bmp") {
    [System.IO.Path]::ChangeExtension($sourceRelative, ".jpg")
  } else {
    $sourceRelative
  }
  $destination = Join-Path $destinationRoot $webRelative
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  $destinationExists = Test-Path -LiteralPath $destination
  $destinationFile = if ($destinationExists) { Get-Item -LiteralPath $destination } else { $null }
  $needsUpdate = -not $destinationExists -or
    $sourceFile.LastWriteTimeUtc -gt $destinationFile.LastWriteTimeUtc -or
    ($sourceFile.Extension -ine ".bmp" -and $sourceFile.Length -ne $destinationFile.Length)

  if ($needsUpdate -and $sourceFile.Extension -ieq ".bmp") {
    $sourceImage = [System.Drawing.Image]::FromFile($sourceFile.FullName)
    try {
      $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object MimeType -eq "image/jpeg"
      $qualityEncoder = [System.Drawing.Imaging.Encoder]::Quality
      $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        $qualityEncoder,
        [long]90
      )
      $sourceImage.Save($destination, $jpegCodec, $encoderParameters)
    } finally {
      $sourceImage.Dispose()
      if ($encoderParameters) { $encoderParameters.Dispose() }
    }
  } elseif ($needsUpdate) {
    Copy-Item -LiteralPath $sourceFile.FullName -Destination $destination -Force
  }

  $webImage = [System.Drawing.Image]::FromFile($destination)
  try {
    $ratio = $webImage.Width / $webImage.Height
    $format = if ($ratio -ge 1.45) {
      "wide"
    } elseif ($ratio -le 0.9) {
      "portrait"
    } else {
      "square"
    }
  } finally {
    $webImage.Dispose()
  }

  [PSCustomObject]@{
    Path = "assets/library/" + $webRelative.Replace("\", "/")
    Format = $format
  }
}

$catalogLines = foreach ($record in $records) {
  $safePath = $record.Path.Replace("\", "\\").Replace('"', '\"')
  "  { path: `"$safePath`", format: `"$($record.Format)`" },"
}

$catalogContent = @(
  "/* Auto-generated from Portfolio/Images. Do not edit by hand. */"
  "window.PORTFOLIO_IMAGE_CATALOG = ["
  $catalogLines
  "];"
) -join [Environment]::NewLine

[System.IO.File]::WriteAllText(
  $catalogPath,
  $catalogContent + [Environment]::NewLine,
  (New-Object System.Text.UTF8Encoding($false))
)

$headerFiles = Get-ChildItem -LiteralPath $headerRoot -File -Recurse -Force |
  Where-Object { $_.Extension -match "^\.(jpg|jpeg|png|gif|webp|avif)$" } |
  Sort-Object FullName

$headerLines = foreach ($headerFile in $headerFiles) {
  $headerRelative = $headerFile.FullName.Substring($webRoot.Length + 1).Replace("\", "/")
  $safeHeaderPath = $headerRelative.Replace("\", "\\").Replace('"', '\"')
  $headerTitle = [System.IO.Path]::GetFileNameWithoutExtension($headerFile.Name) -replace "[_-]+", " "
  $headerTitle = (Get-Culture).TextInfo.ToTitleCase($headerTitle.ToLower())
  $safeHeaderTitle = $headerTitle.Replace("\", "\\").Replace('"', '\"')
  "  { path: `"$safeHeaderPath`", title: `"$safeHeaderTitle`" },"
}

$headerCatalogContent = @(
  "/* Auto-generated from Web/assets/header-carousel. Do not edit by hand. */"
  "window.PORTFOLIO_HEADER_CAROUSEL = ["
  $headerLines
  "];"
) -join [Environment]::NewLine

[System.IO.File]::WriteAllText(
  $headerCatalogPath,
  $headerCatalogContent + [Environment]::NewLine,
  (New-Object System.Text.UTF8Encoding($false))
)

Write-Output "Content synchronized: $($records.Count) gallery images, $($headerFiles.Count) header images."
