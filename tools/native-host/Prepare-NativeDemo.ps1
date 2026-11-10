param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ApprovedSha,
  [Parameter(Mandatory=$true)][datetimeoffset]$StartAt
)
$ErrorActionPreference='Stop'
# Preparation only: no registration, log enabling, PostgreSQL start or mission admission.
$checkout='C:/autopilot-worktrees/mission-native-host-20261109'
$output='C:/autopilot-worktrees/mission-native-host-proposal-20261109'
if ((& git -C $checkout rev-parse HEAD) -ne $ApprovedSha) { throw 'unapproved_checkout' }
if (Test-Path -LiteralPath $output) { throw 'proposal_directory_already_exists' }
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$node=(Get-Command node -CommandType Application | Select-Object -First 1).Source
$git=(Get-Command git -CommandType Application | Select-Object -First 1).Source
$psql=(Get-Command psql -CommandType Application | Select-Object -First 1).Source
New-Item -ItemType Directory -Path $output | Out-Null
New-Item -ItemType Directory -Path "$output/evidence" | Out-Null
Copy-Item -LiteralPath "$checkout/tools/native-host/execution-host.json" -Destination "$output/execution-host.json"
$hash=(Get-FileHash -LiteralPath "$output/execution-host.json" -Algorithm SHA256).Hash.ToLowerInvariant()
@{version=1;checkout=$checkout;approvedSha=$ApprovedSha;executionConfig="$output/execution-host.json";configSha256=$hash;
  evidenceDirectory="$output/evidence";taskName='\Victoriosas-Autopilot-Synthetic-Demo';missionId='synthetic-native-ord204g';
  node=$node;git=$git;psql=$psql;maxDurationMs=45000} | ConvertTo-Json | Set-Content -LiteralPath "$output/manifest.json" -Encoding ASCII
$xml=[xml](Get-Content -LiteralPath "$checkout/tools/native-host/task.disabled.xml" -Raw)
$ns=New-Object System.Xml.XmlNamespaceManager($xml.NameTable);$ns.AddNamespace('t',$xml.DocumentElement.NamespaceURI)
$xml.SelectSingleNode('//t:UserId',$ns).InnerText=$sid
$xml.SelectSingleNode('//t:StartBoundary',$ns).InnerText=$StartAt.ToString('yyyy-MM-ddTHH:mm:sszzz')
$xml.SelectSingleNode('//t:EndBoundary',$ns).InnerText=$StartAt.AddMinutes(20).ToString('yyyy-MM-ddTHH:mm:sszzz')
$xml.SelectSingleNode('//t:Command',$ns).InnerText=$node
$xml.Save("$output/task.disabled.xml")
# Ask the native parser to validate, but never register it.
$service=New-Object -ComObject 'Schedule.Service';$service.Connect()
$definition=$service.NewTask(0);$definition.XmlText=$xml.OuterXml
Write-Output "PREPARED only: $output (task disabled, no infrastructure started)"
