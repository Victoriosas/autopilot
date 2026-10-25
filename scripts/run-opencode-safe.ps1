param(
  [Parameter(Mandatory=$true)][string]$Prompt,
  [string]$Model='opencode/mimo-v2.6-flash-free',
  [string]$Agent='build',
  [int]$TimeoutSeconds=90
)
$ErrorActionPreference='Stop'
if($Agent -like 'ecc-*'){throw 'ECC is a subagent: invoke from a primary agent, not via --agent.'}
$exe=Join-Path $env:APPDATA 'npm\node_modules\opencode-ai\bin\opencode.exe'
$dir=Join-Path $env:TEMP ('opencode-smoke-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $dir | Out-Null
$stdin=Join-Path $dir 'stdin.txt'
[IO.File]::WriteAllText($stdin,'')
$stdout=Join-Path $dir 'stdout.txt'
$stderr=Join-Path $dir 'stderr.txt'
$p=Start-Process -FilePath $exe -ArgumentList @('run','--pure','--agent',$Agent,'--model',$Model,$Prompt) -PassThru -RedirectStandardInput $stdin -RedirectStandardOutput $stdout -RedirectStandardError $stderr
if(-not $p.WaitForExit($TimeoutSeconds*1000)){
  $p.Kill();$p.WaitForExit()
  Write-Output 'TIMEOUT'
  exit 124
}
$p.Refresh()
Write-Output 'STDOUT:'
Get-Content $stdout
Write-Output 'STDERR:'
Get-Content $stderr
if([string]::IsNullOrWhiteSpace((Get-Content $stdout -Raw))){throw 'No response produced'}
