$ErrorActionPreference = "Stop"

$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$portfolioRoot = Split-Path $webRoot -Parent
$sourceRoot = Join-Path $portfolioRoot "Images"
$destinationRoot = Join-Path $webRoot "assets\library"
$catalogPath = Join-Path $webRoot "scripts\image-catalog.js"
$headerRoot = Join-Path $webRoot "assets\header-carousel"
$headerCatalogPath = Join-Path $webRoot "scripts\header-carousel.js"
$aboutSourceRoot = Join-Path $portfolioRoot "About"
$aboutDestinationRoot = Join-Path $webRoot "assets\about"
$indexPath = Join-Path $webRoot "index.html"
$contentMetadataScript = Join-Path $PSScriptRoot "content-metadata.ps1"

$imageExtensions = @(".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".avif")
$videoExtensions = @(".mp4", ".webm")
$mediaExtensions = $imageExtensions + $videoExtensions
$aboutAssetExtensions = $imageExtensions + @(".docx")

if (-not (Test-Path -LiteralPath $sourceRoot)) {
  throw "Source media folder was not found: $sourceRoot"
}

New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null
New-Item -ItemType Directory -Force -Path $headerRoot | Out-Null
if (Test-Path -LiteralPath $aboutSourceRoot -PathType Container) {
  New-Item -ItemType Directory -Force -Path $aboutDestinationRoot | Out-Null
}
Add-Type -AssemblyName System.Drawing
$strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
. $contentMetadataScript

function Test-SupportedMedia {
  param([System.IO.FileInfo]$File)
  return $mediaExtensions -contains $File.Extension.ToLowerInvariant()
}

function Get-FileVersion {
  param([System.IO.FileInfo]$File)
  return Get-ShortFileHash -Path $File.FullName
}

function Get-ShortFileHash {
  param([string]$Path)

  $hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $hashBytes = $hashAlgorithm.ComputeHash($stream)
    $hash = ([System.BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()
    return $hash.Substring(0, 12)
  } finally {
    $stream.Dispose()
    $hashAlgorithm.Dispose()
  }
}

function Get-ImageFormat {
  param([string]$Path, [string]$Extension)

  if (@(".webp", ".avif") -contains $Extension.ToLowerInvariant()) {
    return "wide"
  }

  $image = [System.Drawing.Image]::FromFile($Path)
  try {
    $ratio = $image.Width / $image.Height
    if ($ratio -ge 1.45) { return "wide" }
    if ($ratio -le 0.9) { return "portrait" }
    return "square"
  } finally {
    $image.Dispose()
  }
}

function Convert-MetadataBytesToText {
  param(
    [byte[]]$Bytes,
    [ValidateSet("Utf8", "Utf16", "UserComment")]
    [string]$Encoding = "Utf8"
  )

  if (-not $Bytes -or $Bytes.Length -eq 0) { return $null }

  if ($Encoding -eq "Utf16") {
    return [System.Text.Encoding]::Unicode.GetString($Bytes).Trim([char]0).Trim()
  }

  if ($Encoding -eq "UserComment" -and $Bytes.Length -gt 8) {
    $encodingMarker = [System.Text.Encoding]::ASCII.GetString($Bytes, 0, 8).Trim([char]0)
    $payload = [byte[]]$Bytes[8..($Bytes.Length - 1)]
    if ($encodingMarker -eq "UNICODE") {
      if ($payload.Length -ge 2 -and $payload[0] -eq 0xFE -and $payload[1] -eq 0xFF) {
        return [System.Text.Encoding]::BigEndianUnicode.GetString($payload, 2, $payload.Length - 2).Trim([char]0).Trim()
      }
      if ($payload.Length -ge 2 -and $payload[0] -eq 0xFF -and $payload[1] -eq 0xFE) {
        return [System.Text.Encoding]::Unicode.GetString($payload, 2, $payload.Length - 2).Trim([char]0).Trim()
      }
      return [System.Text.Encoding]::Unicode.GetString($payload).Trim([char]0).Trim()
    }
    $Bytes = $payload
  }

  try {
    return $strictUtf8.GetString($Bytes).Trim([char]0).Trim()
  } catch {
    return [System.Text.Encoding]::GetEncoding(1252).GetString($Bytes).Trim([char]0).Trim()
  }
}

function Get-ImageMetadata {
  param([string]$Path)

  $image = [System.Drawing.Image]::FromFile($Path)
  try {
    function Get-MetadataValue {
      param([int[]]$PropertyIds)

      foreach ($propertyId in $PropertyIds) {
        $property = $image.PropertyItems | Where-Object Id -eq $propertyId | Select-Object -First 1
        if (-not $property) { continue }

        $encoding = if ($propertyId -in @(40091, 40092, 40095)) {
          "Utf16"
        } elseif ($propertyId -eq 37510) {
          "UserComment"
        } else {
          "Utf8"
        }
        $value = Convert-MetadataBytesToText -Bytes $property.Value -Encoding $encoding
        if ([string]::IsNullOrWhiteSpace($value)) { continue }

        $value = ($value -replace "\s+", " ").Trim()
        $placeholderValue = ($value.ToLowerInvariant() -replace "\s+", "")
        if ($placeholderValue -match "^(preview|archive)([/|,;-](preview|archive))*$") { continue }

        return $value
      }

      return $null
    }

    $title = Get-MetadataValue -PropertyIds @(40091, 269)
    $description = Get-MetadataValue -PropertyIds @(40092, 37510, 632, 270, 40095)
    $specialInstructions = Get-MetadataValue -PropertyIds @(552)
    if ([string]::IsNullOrWhiteSpace($specialInstructions)) {
      $specialInstructions = Get-IptcDatasetText -Path $Path -Record 2 -Dataset 40
    }
    if ($title -and $description -and $title -eq $description) { $description = $null }

    return [PSCustomObject]@{
      Title = $title
      Description = $description
      Thumbnail = Get-ThumbnailInstruction -SpecialInstructions $specialInstructions
    }
  } finally {
    $image.Dispose()
  }
}

function Convert-BitmapToJpeg {
  param([string]$Source, [string]$Destination)

  $sourceImage = [System.Drawing.Image]::FromFile($Source)
  $encoderParameters = $null
  try {
    $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
      Where-Object MimeType -eq "image/jpeg"
    $qualityEncoder = [System.Drawing.Imaging.Encoder]::Quality
    $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
      $qualityEncoder,
      [long]90
    )
    $sourceImage.Save($Destination, $jpegCodec, $encoderParameters)
  } finally {
    $sourceImage.Dispose()
    if ($encoderParameters) { $encoderParameters.Dispose() }
  }
}

$sourceFiles = Get-ChildItem -LiteralPath $sourceRoot -File -Recurse -Force |
  Where-Object { Test-SupportedMedia $_ } |
  Sort-Object FullName

$expectedDestinations = New-Object "System.Collections.Generic.HashSet[string]" (
  [System.StringComparer]::OrdinalIgnoreCase
)

$records = foreach ($sourceFile in $sourceFiles) {
  $sourceRelative = $sourceFile.FullName.Substring($sourceRoot.Length + 1)
  $sourceExtension = $sourceFile.Extension.ToLowerInvariant()
  $webRelative = if ($sourceExtension -eq ".bmp") {
    [System.IO.Path]::ChangeExtension($sourceRelative, ".jpg")
  } else {
    $sourceRelative
  }

  $destination = Join-Path $destinationRoot $webRelative
  $destination = [System.IO.Path]::GetFullPath($destination)
  [void]$expectedDestinations.Add($destination)
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null

  $destinationExists = Test-Path -LiteralPath $destination
  $destinationFile = if ($destinationExists) { Get-Item -LiteralPath $destination } else { $null }
  $needsUpdate = if (-not $destinationExists) {
    $true
  } elseif ($sourceExtension -eq ".bmp") {
    $sourceFile.LastWriteTimeUtc -gt $destinationFile.LastWriteTimeUtc
  } else {
    (Get-ShortFileHash -Path $sourceFile.FullName) -ne
      (Get-ShortFileHash -Path $destinationFile.FullName)
  }

  if ($needsUpdate -and $sourceExtension -eq ".bmp") {
    Convert-BitmapToJpeg -Source $sourceFile.FullName -Destination $destination
  } elseif ($needsUpdate) {
    Copy-Item -LiteralPath $sourceFile.FullName -Destination $destination -Force
  }

  $webFile = Get-Item -LiteralPath $destination
  $mediaType = if ($videoExtensions -contains $sourceExtension) { "video" } else { "image" }
  $format = if ($mediaType -eq "video") {
    "wide"
  } else {
    Get-ImageFormat -Path $destination -Extension $webFile.Extension
  }
  $imageMetadata = if ($sourceExtension -in @(".jpg", ".jpeg")) {
    Get-ImageMetadata -Path $sourceFile.FullName
  } else {
    [PSCustomObject]@{ Title = $null; Description = $null; Thumbnail = "cover" }
  }

  [PSCustomObject]@{
    Path = "assets/library/" + $webRelative.Replace("\", "/")
    Format = $format
    Type = $mediaType
    Version = Get-FileVersion $webFile
    Title = $imageMetadata.Title
    Description = $imageMetadata.Description
    Thumbnail = $imageMetadata.Thumbnail
  }
}

# The library is a generated mirror. Remove files whose source was deleted or renamed.
Get-ChildItem -LiteralPath $destinationRoot -File -Recurse -Force | ForEach-Object {
  if (-not $expectedDestinations.Contains($_.FullName)) {
    Remove-Item -LiteralPath $_.FullName -Force
  }
}

Get-ChildItem -LiteralPath $destinationRoot -Directory -Recurse -Force |
  Sort-Object FullName -Descending |
  Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force) } |
  Remove-Item -Force

$catalogLines = foreach ($record in $records) {
  $safePath = $record.Path.Replace("\", "\\").Replace('"', '\"')
  $titleValue = if ([string]::IsNullOrWhiteSpace($record.Title)) {
    "null"
  } else {
    ConvertTo-Json -InputObject $record.Title -Compress
  }
  $descriptionValue = if ([string]::IsNullOrWhiteSpace($record.Description)) {
    "null"
  } else {
    ConvertTo-Json -InputObject $record.Description -Compress
  }
  $thumbnailValue = ConvertTo-Json -InputObject $record.Thumbnail -Compress
  "  { path: `"$safePath`", format: `"$($record.Format)`", type: `"$($record.Type)`", version: `"$($record.Version)`", title: $titleValue, description: $descriptionValue, thumbnail: $thumbnailValue },"
}

$folderMetadataRecords = Get-FolderMetadataRecords -RootPath $sourceRoot
$folderMetadataLines = foreach ($record in $folderMetadataRecords) {
  $pathValue = ConvertTo-Json -InputObject $record.Path -Compress
  $markdownValue = ConvertTo-Json -InputObject $record.Markdown -Compress
  $urlValue = if ([string]::IsNullOrWhiteSpace($record.Url)) {
    "null"
  } else {
    ConvertTo-Json -InputObject $record.Url -Compress
  }
  "  ${pathValue}: { markdown: $markdownValue, url: $urlValue },"
}

$catalogContent = @(
  "/* Auto-generated from Portfolio/Images. Do not edit by hand. */"
  "window.PORTFOLIO_IMAGE_CATALOG = ["
  $catalogLines
  "];"
  "window.PORTFOLIO_FOLDER_METADATA = {"
  $folderMetadataLines
  "};"
) -join [Environment]::NewLine

[System.IO.File]::WriteAllText(
  $catalogPath,
  $catalogContent + [Environment]::NewLine,
  (New-Object System.Text.UTF8Encoding($false))
)

$headerFiles = Get-ChildItem -LiteralPath $headerRoot -File -Recurse -Force |
  Where-Object { $imageExtensions -contains $_.Extension.ToLowerInvariant() -and $_.Extension -ne ".bmp" } |
  Sort-Object FullName

$headerLines = foreach ($headerFile in $headerFiles) {
  $headerRelative = $headerFile.FullName.Substring($webRoot.Length + 1).Replace("\", "/")
  $safeHeaderPath = $headerRelative.Replace("\", "\\").Replace('"', '\"')
  $headerMetadata = if ($headerFile.Extension.ToLowerInvariant() -in @(".jpg", ".jpeg")) {
    Get-ImageMetadata -Path $headerFile.FullName
  } else {
    [PSCustomObject]@{ Title = $null; Description = $null }
  }
  $headerTitleValue = if ([string]::IsNullOrWhiteSpace($headerMetadata.Title)) {
    "null"
  } else {
    ConvertTo-Json -InputObject $headerMetadata.Title -Compress
  }
  $headerDescriptionValue = if ([string]::IsNullOrWhiteSpace($headerMetadata.Description)) {
    "null"
  } else {
    ConvertTo-Json -InputObject $headerMetadata.Description -Compress
  }
  $version = Get-FileVersion $headerFile
  "  { path: `"$safeHeaderPath`", title: $headerTitleValue, description: $headerDescriptionValue, version: `"$version`" },"
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

# About is authored next to Images. Keep its web copy current, while preserving
# any unrelated working files already present in Web/assets/about.
$aboutRecords = @()
if (Test-Path -LiteralPath $aboutSourceRoot -PathType Container) {
  $aboutRecords = @(Get-ChildItem -LiteralPath $aboutSourceRoot -File -Recurse -Force |
      Where-Object { $aboutAssetExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object FullName |
    ForEach-Object {
      $aboutRelative = $_.FullName.Substring($aboutSourceRoot.Length + 1)
      $aboutDestination = Join-Path $aboutDestinationRoot $aboutRelative
      New-Item -ItemType Directory -Force -Path (Split-Path $aboutDestination -Parent) | Out-Null

      $aboutDestinationExists = Test-Path -LiteralPath $aboutDestination
      $aboutDestinationFile = if ($aboutDestinationExists) {
        Get-Item -LiteralPath $aboutDestination
      } else {
        $null
      }
      if (
        -not $aboutDestinationExists -or
        (Get-ShortFileHash -Path $_.FullName) -ne
          (Get-ShortFileHash -Path $aboutDestinationFile.FullName)
      ) {
        Copy-Item -LiteralPath $_.FullName -Destination $aboutDestination -Force
      }

      $webAboutFile = Get-Item -LiteralPath $aboutDestination
      [PSCustomObject]@{
        Path = "assets/about/" + $aboutRelative.Replace("\", "/")
        Version = Get-FileVersion $webAboutFile
      }
    })
}

# Give changed CSS/JavaScript a new URL so browsers never keep an old version.
$versionedAssets = @(
  "styles/main.css",
  "scripts/image-catalog.js",
  "scripts/header-carousel.js",
  "scripts/projects.js",
  "scripts/main.js"
)
$indexContent = [System.IO.File]::ReadAllText($indexPath)
foreach ($relativeAsset in $versionedAssets) {
  $assetPath = Join-Path $webRoot $relativeAsset.Replace("/", "\")
  $assetHash = Get-ShortFileHash -Path $assetPath
  $escapedAsset = [regex]::Escape($relativeAsset)
  $indexContent = [regex]::Replace(
    $indexContent,
    "$escapedAsset(?:\?v=[^`"]+)?",
    "$relativeAsset`?v=$assetHash"
  )
}
foreach ($aboutRecord in $aboutRecords) {
  $escapedAboutPath = [regex]::Escape($aboutRecord.Path)
  $indexContent = [regex]::Replace(
    $indexContent,
    "$escapedAboutPath(?:\?v=[^`"]+)?",
    "$($aboutRecord.Path)`?v=$($aboutRecord.Version)"
  )
}
[System.IO.File]::WriteAllText(
  $indexPath,
  $indexContent,
  (New-Object System.Text.UTF8Encoding($false))
)

$imageCount = @($records | Where-Object Type -eq "image").Count
$videoCount = @($records | Where-Object Type -eq "video").Count
Write-Output "Content synchronized: $imageCount images, $videoCount videos, $($headerFiles.Count) header images, $($aboutRecords.Count) about files."
