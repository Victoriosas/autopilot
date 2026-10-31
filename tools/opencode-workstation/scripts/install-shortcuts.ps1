param([string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path)
$ErrorActionPreference = 'Stop'
$toolRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = (Get-Command node.exe).Source
$desktop = [Environment]::GetFolderPath('Desktop')
$newProjects = 'C:\Proyectos-AI'
New-Item -ItemType Directory -Force $newProjects | Out-Null
if (-not (Test-Path "$newProjects\PLANTILLA_PROYECTO.md")) { Copy-Item "$toolRoot\PROJECT_TEMPLATE.md" "$newProjects\PLANTILLA_PROYECTO.md" }
if (-not (Test-Path "$newProjects\AGENTS.md")) { Copy-Item "$toolRoot\REGLAS.md" "$newProjects\AGENTS.md" }
$shell = New-Object -ComObject WScript.Shell
$entries = @(
    @{Name='Victoriosas - OpenCode'; Project=$ProjectRoot; Extra=''},
    @{Name='OpenCode - Nuevos proyectos'; Project=$newProjects; Extra='--agent arquitecto'},
    @{Name='OpenCode Gratis - Groq'; Project=$ProjectRoot; Extra='--free'}
)
foreach ($entry in $entries) {
    $shortcut = $shell.CreateShortcut((Join-Path $desktop ($entry.Name + '.lnk')))
    $shortcut.TargetPath = $node
    $shortcut.Arguments = '"{0}\scripts\start.mjs" --project "{1}" {2}' -f $toolRoot,$entry.Project,$entry.Extra
    $shortcut.WorkingDirectory = $entry.Project
    $shortcut.Description = 'OpenCode Autopilot - local project profile'
    $shortcut.Save()
}
[Environment]::SetEnvironmentVariable('OPENCODE_WORKSTATION_HOME',$toolRoot.Replace('\','/'),'User')
$cli = Join-Path $env:APPDATA 'npm\autopilot-code.cmd'
$content = '@echo off' + [Environment]::NewLine + '"' + $node + '" "' + $toolRoot + '\scripts\start.mjs" %*' + [Environment]::NewLine
Set-Content -LiteralPath $cli -Encoding ascii -Value $content
$control = Join-Path $env:APPDATA 'npm\autopilot-control.cmd'
$controlContent = '@echo off' + [Environment]::NewLine + '"' + $node + '" "' + $toolRoot + '\scripts\control.mjs" %*' + [Environment]::NewLine
Set-Content -LiteralPath $control -Encoding ascii -Value $controlContent
Write-Output 'Three desktop shortcuts and autopilot-code command installed'
