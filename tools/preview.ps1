param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$previewRoot = Join-Path $webRoot '.deploy'
$previewUrl = 'http://127.0.0.1:8765/'
$indexPath = Join-Path $previewRoot 'index.html'
if (-not (Test-Path -LiteralPath $indexPath)) {
  throw 'Run 01 PREVIEW-WEB.cmd to build the preview first.'
}
$expectedIndex = [System.IO.File]::ReadAllText($indexPath)

function Test-PreviewServer {
  try {
    $response = Invoke-WebRequest -Uri ($previewUrl + '?preview_check=' + [DateTime]::UtcNow.Ticks) -UseBasicParsing -TimeoutSec 2
  } catch {
    return $false
  }
  $servedIndex = [System.Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray())
  if ($servedIndex -cne $expectedIndex) {
    throw 'Port 8765 is serving a different site or an old preview. Close that server and run Preview again.'
  }
  return $true
}

if (-not (Test-PreviewServer)) {
  $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
  $pythonPath = if ($pythonCommand) { $pythonCommand.Source } else { $null }
  if (-not $pythonPath) {
    $bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if (Test-Path -LiteralPath $bundledPython) { $pythonPath = $bundledPython }
  }
  if (-not $pythonPath) { throw 'Python is required to start the local preview server.' }

  $server = Start-Process -FilePath $pythonPath -ArgumentList @(
    '-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', ('"' + $previewRoot + '"')
  ) -WorkingDirectory $webRoot -WindowStyle Hidden -PassThru
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if ($server.HasExited) { throw 'The local preview server could not start on port 8765.' }
    if (Test-PreviewServer) { $ready = $true; break }
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) {
    Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
    throw 'The local preview server did not become ready.'
  }
}

Write-Output "Local portfolio preview: $previewUrl"
if (-not $NoBrowser) { Start-Process $previewUrl -WindowStyle Hidden }
