param(
  [Parameter(Mandatory=$true)][ValidateSet('Window','Check','Stop')][string]$Action,
  [switch]$ApprovedWindow,
  [string]$ProposalDirectory,
  [datetimeoffset]$CloseAt
)
$ErrorActionPreference='Stop'
$data='C:/autopilot-worktrees/queue-fencing-20261109-pg'
$ctl='C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe'
$psql='C:/Program Files/PostgreSQL/18/bin/psql.exe'
if ((Get-Item -LiteralPath $data).Attributes -band [IO.FileAttributes]::ReparsePoint -or (Get-Content "$data/PG_VERSION") -ne '18') { throw 'wrong_dedicated_lab' }
$env:PGHOSTADDR=$null;$env:PGOPTIONS='-c statement_timeout=3000 -c lock_timeout=3000'
function Stop-DedicatedLab {
  & $ctl stop -D $data -m fast -w -t 15
  if ($LASTEXITCODE -ne 0) { throw 'lab_stop_failed' }
}
if ($Action -eq 'Check') {
  $result=& $psql -h 127.0.0.1 -p 55439 -U postgres -d victoriosa_mission_operator_lab -w -X -qAt -v ON_ERROR_STOP=1 -c "select current_setting('listen_addresses')='127.0.0.1' and current_setting('port')='55439' and replace(lower(current_setting('data_directory')),chr(92),'/')='c:/autopilot-worktrees/queue-fencing-20261109-pg';"
  if ($LASTEXITCODE -ne 0 -or $result -ne 't') { throw 'lab_unavailable_or_wrong_server' };Write-Output 'Dedicated loopback lab verified';exit
}
if (-not $ApprovedWindow) { throw 'specific_window_approval_required' }
if ($Action -eq 'Stop') { Stop-DedicatedLab;exit }
if (-not $PSBoundParameters.ContainsKey('CloseAt')) { throw 'specific_close_deadline_required' }
$stopAt = $CloseAt.AddSeconds(-20)
if ($stopAt -le [datetimeoffset]::Now -or $CloseAt -gt [datetimeoffset]::Now.AddMinutes(30)) {
  throw 'invalid_lab_deadline'
}
if ($ProposalDirectory -notmatch '^[a-zA-Z]:[\\/]') { throw 'local_absolute_proposal_required' }
$root = (Resolve-Path -LiteralPath $ProposalDirectory).Path
$proposal = Get-Content -LiteralPath "$root/manifest.json" -Raw | ConvertFrom-Json
$request = Get-Content -LiteralPath "$PSScriptRoot/mission-request.json" -Raw | ConvertFrom-Json
if ($proposal.missionId -ne $request.id) { throw 'wrong_recovery_proposal' }
& $ctl status -D $data *> $null
if ($LASTEXITCODE -ne 3) { throw 'lab_already_running_or_unknown' }
$started=$false
try {
  # Dedicated existing data only, forced IPv4 loopback; no service registration.
  & $ctl start -D $data -o '-h 127.0.0.1 -p 55439' -l "$root/postgres-window.log" -w -t 15
  if ($LASTEXITCODE -ne 0) { throw 'lab_start_failed' };$started=$true
  Write-Output 'Dedicated PostgreSQL window active. Keep this controller alive through cleanup.'
  while ([datetimeoffset]::Now -lt $stopAt) {
    $remainingMs = ($stopAt - [datetimeoffset]::Now).TotalMilliseconds
    Start-Sleep -Milliseconds ([int][Math]::Max(1, [Math]::Min(1000, $remainingMs)))
  }
} finally { if ($started) { Stop-DedicatedLab } }
