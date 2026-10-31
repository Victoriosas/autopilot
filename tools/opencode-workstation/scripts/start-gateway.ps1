$ErrorActionPreference = 'Stop'
$root = 'C:\freellmapi-lab'
try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3001/health' -TimeoutSec 3 -UseBasicParsing
    if ($r.StatusCode -eq 200) { Write-Output 'FreeLLMAPI already running'; exit 0 }
} catch {}
if (-not (Test-Path "$root\server\dist\index.js")) { throw 'Existing FreeLLMAPI installation not found' }
$env:HOST = '127.0.0.1'
$env:PORT = '3001'
$log = Join-Path $env:LOCALAPPDATA 'OpenCodeAutopilot'
New-Item -ItemType Directory -Path $log -Force | Out-Null
Start-Process -FilePath 'node.exe' -ArgumentList 'server/dist/index.js' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput "$log\gateway.log" -RedirectStandardError "$log\gateway-error.log"
Write-Output 'FreeLLMAPI started locally; check http://127.0.0.1:3001'
