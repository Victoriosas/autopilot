param(
  [ValidateSet('status','verify')][string]$Action='status',
  [ValidateSet('autopilot','marketplace','expressjobs','nomadea')][string]$Project='autopilot'
)
$ErrorActionPreference='Stop'
$projects=[ordered]@{
  autopilot=[pscustomobject]@{Path=(Split-Path $PSScriptRoot -Parent); Verify='verify'}
  marketplace=[pscustomobject]@{Path='C:\victoriosa-autopilot-admin-control-center'; Verify=$null}
  expressjobs=[pscustomobject]@{Path='C:\CODEX-expressjobs-repo'; Verify=$null}
  nomadea=[pscustomobject]@{Path='C:\web'; Verify=$null}
}
if($Action -eq 'status'){
  foreach($name in $projects.Keys){
    $entry=$projects[$name]
    Write-Output "PROJECT=$name PATH=$($entry.Path)"
    if(!(Test-Path -LiteralPath $entry.Path)){Write-Output 'MISSING'; continue}
    git -C $entry.Path status --short --branch
    if($LASTEXITCODE -ne 0){throw "Cannot inspect $name"}
  }
  exit 0
}
$target=$projects[$Project]
if(!$target.Verify){throw 'This project retains its own verification gates. Read its AGENTS.md before running checks.'}
Push-Location -LiteralPath $target.Path
try { & npm.cmd run $target.Verify; $verifyExit=$LASTEXITCODE } finally { Pop-Location }
exit $verifyExit
