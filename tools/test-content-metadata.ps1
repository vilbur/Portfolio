$ErrorActionPreference = "Stop"
$toolsRoot = (Resolve-Path $PSScriptRoot).Path
. (Join-Path $toolsRoot "content-metadata.ps1")

$fixtureRoot = Join-Path $toolsRoot "fixtures\content"
$records = @(Get-FolderMetadataRecords -RootPath $fixtureRoot)
$validRecord = $records | Where-Object Path -eq "01_Category" | Select-Object -First 1

if (-not $validRecord) { throw "Localized content fixture was not discovered." }
if ($validRecord.Markdown.en -notmatch "\*\*bold text\*\*") { throw "English Markdown content was not read." }
$expectedCzechMarkdown = "**tu" + [char]0x010D + "n" + [char]0x00FD + "m textem**"
if ($validRecord.Markdown.cs.IndexOf($expectedCzechMarkdown, [System.StringComparison]::Ordinal) -lt 0) {
  throw "Czech Markdown content was not read."
}
if ($validRecord.Markdown.en -match "Legacy test category") { throw "Legacy content.md overrode localized content." }
if ($validRecord.Url -ne "https://example.com/portfolio") { throw "Valid .url value was not accepted." }
if ($records.Path -contains "01_Category/01_Invalid") { throw "Invalid .url value was accepted." }
if ($records.Path -contains "02_No_Metadata") { throw "Empty folder metadata produced a placeholder record." }

$thumbnailCases = @(
  @{ Input = $null; Expected = "cover" },
  @{ Input = "thumbnail=contain"; Expected = "contain" },
  @{ Input = " THUMBNAIL = COVER "; Expected = "cover" },
  @{ Input = "credit=artist; thumbnail = bottom; future=value"; Expected = "bottom" },
  @{ Input = "thumbnail=unknown; thumbnail=center"; Expected = "center" },
  @{ Input = "thumbnail=unknown"; Expected = "cover" }
)
foreach ($thumbnailCase in $thumbnailCases) {
  $actual = Get-ThumbnailInstruction -SpecialInstructions $thumbnailCase.Input
  if ($actual -ne $thumbnailCase.Expected) {
    throw "Thumbnail instruction '$($thumbnailCase.Input)' resolved to '$actual' instead of '$($thumbnailCase.Expected)'."
  }
}

$iptcFixturePath = Join-Path ([System.IO.Path]::GetTempPath()) ("portfolio-iptc-" + [guid]::NewGuid().ToString("N") + ".jpg")
try {
  $iptcValue = [System.Text.Encoding]::UTF8.GetBytes("credit=artist; THUMBNAIL = contain")
  $iptcPayload = New-Object "System.Collections.Generic.List[byte]"
  $iptcPayload.AddRange([byte[]][System.Text.Encoding]::ASCII.GetBytes("Photoshop 3.0`0"))
  $iptcPayload.AddRange([byte[]]@(0x1C, 0x02, 0x28, [byte]($iptcValue.Length -shr 8), [byte]($iptcValue.Length -band 0xFF)))
  $iptcPayload.AddRange([byte[]]$iptcValue)
  $segmentLength = $iptcPayload.Count + 2
  $jpegFixture = New-Object "System.Collections.Generic.List[byte]"
  $jpegFixture.AddRange([byte[]]@(0xFF, 0xD8, 0xFF, 0xED, [byte]($segmentLength -shr 8), [byte]($segmentLength -band 0xFF)))
  $jpegFixture.AddRange($iptcPayload)
  $jpegFixture.AddRange([byte[]]@(0xFF, 0xD9))
  [System.IO.File]::WriteAllBytes($iptcFixturePath, $jpegFixture.ToArray())

  $parsedIptc = Get-IptcDatasetText -Path $iptcFixturePath -Record 2 -Dataset 40
  if ((Get-ThumbnailInstruction -SpecialInstructions $parsedIptc) -ne "contain") {
    throw "Photoshop APP13/IPTC Special Instructions were not parsed as thumbnail=contain."
  }
} finally {
  if (Test-Path -LiteralPath $iptcFixturePath) { Remove-Item -LiteralPath $iptcFixturePath -Force }
}

Write-Output "Metadata tests passed: localized content, safe folder links and thumbnail instructions."
