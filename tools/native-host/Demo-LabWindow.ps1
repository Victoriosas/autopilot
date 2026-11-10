param([Parameter(Mandatory=$true)][ValidateSet('Window','Check','Stop')][string]$Action,[switch]$ApprovedWindow)
$ErrorActionPreference='Stop'
$data='C:/autopilot-worktrees/queue-fencing-20261109-pg'
$root='C:/autopilot-worktrees/mission-native-host-proposal-20261109'
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
if (-not (Test-Path -LiteralPath $root)) { throw 'prepare_proposal_first' }
& $ctl status -D $data *> $null
if ($LASTEXITCODE -ne 3) { throw 'lab_already_running_or_unknown' }
$started=$false
try {
  # Dedicated existing data only, forced IPv4 loopback; no service registration.
  & $ctl start -D $data -o '-h 127.0.0.1 -p 55439' -l "$root/postgres-window.log" -w -t 15
  if ($LASTEXITCODE -ne 0) { throw 'lab_start_failed' };$started=$true
  Write-Output 'Dedicated PostgreSQL window: 30 minutes; keep this controller alive.'
  Start-Sleep -Seconds 1800
} finally { if ($started) { Stop-DedicatedLab } }
