param([Parameter(Mandatory=$true)][int]$LauncherPid)
$ErrorActionPreference='Stop'
try {
  $name='\Victoriosas-Autopilot-Synthetic-Demo'
  $log='Microsoft-Windows-TaskScheduler/Operational'
  if (-not (Get-WinEvent -ListLog $log).IsEnabled) { throw 'native_history_disabled' }
  $matches=@(Get-WinEvent -FilterHashtable @{LogName=$log;Id=129;StartTime=(Get-Date).AddMinutes(-2)} -MaxEvents 100 | ForEach-Object {
    [xml]$xml=$_.ToXml(); $fields=@{}
    foreach($field in $xml.Event.EventData.Data) { $fields[$field.Name]=$field.InnerText }
    if ($fields.TaskName -eq $name -and [int]$fields.ProcessID -eq $LauncherPid) {
      @{mode='windows_task_event';taskName=$name;recordId=$_.RecordId;timestamp=$_.TimeCreated.ToUniversalTime().ToString('o');pid=$LauncherPid;
        userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;user=[Security.Principal.WindowsIdentity]::GetCurrent().Name}
    }
  })
  if ($matches.Count -ne 1) { throw 'unique_native_event_required' }
  $matches[0] | ConvertTo-Json -Compress
} catch { Write-Error 'native_origin_unavailable'; exit 2 }
