$ErrorActionPreference = "Stop"
$toolsRoot = (Resolve-Path $PSScriptRoot).Path
. (Join-Path $toolsRoot "content-metadata.ps1")

$fixtureRoot = Join-Path $toolsRoot "fixtures\content"
$records = @(Get-FolderMetadataRecords -RootPath $fixtureRoot)
$validRecord = $records | Where-Object Path -eq "01_Category" | Select-Object -First 1

if (-not $validRecord) { throw "README.md fixture was not discovered." }
if ($validRecord.Markdown -notmatch "\*\*bold text\*\*") { throw "Markdown content was not read." }
if ($validRecord.Url -ne "https://example.com/portfolio") { throw "Valid .url value was not accepted." }
if ($records.Path -contains "01_Category/01_Invalid") { throw "Invalid .url value was accepted." }
if ($records.Path -contains "02_No_Metadata") { throw "Empty folder metadata produced a placeholder record." }

Write-Output "Folder metadata tests passed: README.md, missing metadata, valid URL and invalid URL."
