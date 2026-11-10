param([Parameter(Mandatory=$true)][int]$LauncherPid)
$ErrorActionPreference = 'Stop'
$name = '\Victoriosas-Autopilot-Synthetic-Demo'
$log = 'Microsoft-Windows-TaskScheduler/Operational'

try {
  if (-not (Get-WinEvent -ListLog $log).IsEnabled) { exit 10 }
  $events = @(Get-WinEvent -FilterHashtable @{LogName=$log; Id=129; StartTime=(Get-Date).AddMinutes(-2)} -MaxEvents 100)
} catch {
  if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound,*') { exit 12 }
  exit 11
}

try {
  $matches = @(foreach ($event in $events) {
    [xml]$xml = $event.ToXml()
    $fields = @{}
    foreach ($field in $xml.Event.EventData.Data) { $fields[$field.Name] = $field.InnerText }
    if ($fields.TaskName -eq $name -and [int]$fields.ProcessID -eq $LauncherPid) {
      @{mode='windows_task_event'; taskName=$name; recordId=$event.RecordId;
        timestamp=$event.TimeCreated.ToUniversalTime().ToString('o'); pid=$LauncherPid;
        userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;
        user=[Security.Principal.WindowsIdentity]::GetCurrent().Name}
    }
  })
  if ($matches.Count -eq 0) { exit 12 }
  if ($matches.Count -gt 1) { exit 13 }
  $matches[0] | ConvertTo-Json -Compress
} catch {
  exit 11
}
