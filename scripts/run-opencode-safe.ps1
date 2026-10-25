param(
  [Parameter(Mandatory=$true)][string]$Prompt,
  [string]$Model='opencode/mimo-v2.6-flash-free',
  [string]$Agent='build',
  [string]$ExpectedSubagent='',
  [int]$TimeoutSeconds=90
)
$ErrorActionPreference='Stop'
if($Agent -like 'ecc-*'){throw 'ECC profiles are subagents; delegate from build.'}
if($TimeoutSeconds -lt 5 -or $TimeoutSeconds -gt 180){throw 'Timeout must be 5..180 seconds'}
$exe=Join-Path $env:APPDATA 'npm\node_modules\opencode-ai\bin\opencode.exe'
$dir=Join-Path $env:TEMP ('opencode-smoke-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $dir | Out-Null
$stdin=Join-Path $dir 'stdin.txt'; [IO.File]::WriteAllText($stdin,'')
$stdout=Join-Path $dir 'stdout.txt'; $stderr=Join-Path $dir 'stderr.txt'
$p=Start-Process -FilePath $exe -ArgumentList @('run','--pure','--agent',$Agent,'--model',$Model,$Prompt) -PassThru -RedirectStandardInput $stdin -RedirectStandardOutput $stdout -RedirectStandardError $stderr
if(-not $p.WaitForExit($TimeoutSeconds*1000)){
  & taskkill.exe /PID $p.Id /T /F 2>$null | Out-Null
  Write-Output ('TIMEOUT; files retained at '+$dir)
  if(Test-Path $stderr){Get-Content $stderr -Tail 15}
  exit 124
}
$p.Refresh()
$out=Get-Content $stdout -Raw -ErrorAction SilentlyContinue
$err=Get-Content $stderr -Raw -ErrorAction SilentlyContinue
Write-Output ('LOG_DIR='+$dir)
Write-Output 'STDOUT:'; Write-Output $out
Write-Output 'STDERR:'; Write-Output $err
if([string]::IsNullOrWhiteSpace($out)){throw 'No model response'}
if($ExpectedSubagent){
  $marker=($ExpectedSubagent -replace '^ecc-','') -replace '-','-'
  if($err -notmatch [regex]::Escape($marker)){throw ('Expected ECC delegation not evidenced: '+$ExpectedSubagent)}
}
