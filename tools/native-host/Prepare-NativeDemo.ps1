param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ApprovedSha,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [Parameter(Mandatory=$true)][datetimeoffset]$StartAt,
  [Parameter(Mandatory=$true)][datetimeoffset]$EndAt,
  [string]$PsqlPath
)
$ErrorActionPreference = 'Stop'
# Preparation only. The proposed definition is disabled and stays unregistered.
$checkout = (Resolve-Path -LiteralPath "$PSScriptRoot/../..").Path
if ($OutputDirectory -notmatch '^[a-zA-Z]:[\\/]') { throw 'local_absolute_output_required' }
$output = [IO.Path]::GetFullPath($OutputDirectory)
if ($output.TrimEnd('\') -eq $checkout -or $output.StartsWith($checkout + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'output_inside_checkout'
}
if ($StartAt -le [datetimeoffset]::Now -or $EndAt -le $StartAt.AddMinutes(2) -or $EndAt -gt $StartAt.AddMinutes(20)) {
  throw 'invalid_proposed_window'
}
$head = & git -C $checkout rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $head -ne $ApprovedSha) { throw 'unapproved_checkout' }
$status = & git -C $checkout status --porcelain
if ($LASTEXITCODE -ne 0 -or $status) {
  throw 'unapproved_checkout'
}
if (Test-Path -LiteralPath $output) { throw 'proposal_directory_already_exists' }
$parent = Get-Item -LiteralPath (Split-Path -Parent $output)
for ($directory = $parent; $directory; $directory = $directory.Parent) {
  if ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'unsafe_output_parent' }
}

$node = (Get-Command node -CommandType Application | Select-Object -First 1).Source
$git = (Get-Command git -CommandType Application | Select-Object -First 1).Source
if (-not $PsqlPath) { $PsqlPath = (Get-Command psql -CommandType Application | Select-Object -First 1).Source }
$psql = (Get-Item -LiteralPath $PsqlPath).FullName
if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) { throw 'invalid_psql_binary' }
$mission = Get-Content -LiteralPath "$PSScriptRoot/mission-request.json" -Raw | ConvertFrom-Json
# Create the proposal with a private ACL before writing any evidence.
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
  $sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
if ($PSVersionTable.PSEdition -eq 'Desktop') {
  [IO.Directory]::CreateDirectory($output, $acl) | Out-Null
} else {
  [IO.FileSystemAclExtensions]::CreateDirectory($acl, $output) | Out-Null
}
New-Item -ItemType Directory -Path "$output/evidence", "$output/diagnostics" | Out-Null
Copy-Item -LiteralPath "$PSScriptRoot/execution-host.json" -Destination "$output/execution-host.json"
Copy-Item -LiteralPath "$PSScriptRoot/mission-request.json" -Destination "$output/mission-request.json"
$hash = (Get-FileHash -LiteralPath "$output/execution-host.json" -Algorithm SHA256).Hash.ToLowerInvariant()
@{version=1; checkout=$checkout; approvedSha=$ApprovedSha; executionConfig="$output/execution-host.json"; configSha256=$hash;
  evidenceDirectory="$output/evidence"; taskName='\Victoriosas-Autopilot-Synthetic-Demo'; missionId=$mission.id;
  node=$node; git=$git; psql=$psql; maxDurationMs=45000} | ConvertTo-Json |
  Set-Content -LiteralPath "$output/manifest.json" -Encoding UTF8
# Windows PowerShell 5.1 writes a BOM. The Node manifest reader accepts UTF-8 with or without it.
$xml = [xml](Get-Content -LiteralPath "$PSScriptRoot/task.disabled.xml" -Raw)
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace('t', $xml.DocumentElement.NamespaceURI)
$xml.SelectSingleNode('//t:UserId', $ns).InnerText = $sid.Value
$xml.SelectSingleNode('//t:StartBoundary', $ns).InnerText = $StartAt.ToString('yyyy-MM-ddTHH:mm:sszzz')
$xml.SelectSingleNode('//t:EndBoundary', $ns).InnerText = $EndAt.ToString('yyyy-MM-ddTHH:mm:sszzz')
$xml.SelectSingleNode('//t:Duration', $ns).InnerText = [Xml.XmlConvert]::ToString($EndAt - $StartAt)
$xml.SelectSingleNode('//t:Command', $ns).InnerText = $node
$xml.SelectSingleNode('//t:WorkingDirectory', $ns).InnerText = $checkout
$xml.SelectSingleNode('//t:Arguments', $ns).InnerText = '--import tsx "{0}/scripts/autopilot-native-host.ts" --diagnostics "{1}/diagnostics" --manifest "{1}/manifest.json" --native' -f $checkout, $output
$service = New-Object -ComObject 'Schedule.Service'
$service.Connect()
$definition = $service.NewTask(0)
$definition.XmlText = $xml.OuterXml
$xml.Save("$output/task.disabled.xml")
Write-Output 'PREPARED only. Task disabled and unregistered.'
