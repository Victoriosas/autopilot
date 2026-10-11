# Creates a disposable local fixture project. Never links, pushes or resets a remote database.
$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$sources = @(
    @{ Source = 'tests/commerce-baseline.sql'; Target = '20261010000000_synthetic_commerce_baseline.sql' },
    @{ Source = 'tests/commerce-supabase-access.sql'; Target = '20261010000001_synthetic_commerce_access.sql' },
    @{ Source = 'supabase/migrations/20261010010000_atomic_checkout.sql'; Target = '20261010010000_atomic_checkout.sql' },
    @{ Source = 'supabase/migrations/20261010020000_payment_reference_recovery.sql'; Target = '20261010020000_payment_reference_recovery.sql' }
)
foreach ($entry in $sources) {
    if (-not (Test-Path -LiteralPath (Join-Path $repository $entry.Source) -PathType Leaf)) {
        throw "Missing fixture source: $($entry.Source)"
    }
}
$workspace = Join-Path ([System.IO.Path]::GetTempPath()) ('victoriosa-supabase-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workspace | Out-Null
& npx --yes supabase@2.120.0 init --workdir $workspace
if ($LASTEXITCODE -ne 0) { throw "Supabase initialization failed. Workspace preserved: $workspace" }
$migrations = Join-Path $workspace 'supabase/migrations'
New-Item -ItemType Directory -Path $migrations -Force | Out-Null
foreach ($entry in $sources) {
    $source = Join-Path $repository $entry.Source
    $destination = Join-Path $migrations $entry.Target
    Copy-Item -LiteralPath $source -Destination $destination
    if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $destination).Hash) {
        throw "Fixture copy verification failed: $($entry.Source)"
    }
}
[ordered]@{
    workspace = $workspace
    cliVersion = '2.120.0'
    syntheticMigrations = $sources.Count
    stackStarted = $false
    prerequisite = 'Docker daemon; no production credentials or project linking'
    nextCommand = "npx --yes supabase@2.120.0 start --workdir '$workspace'"
} | ConvertTo-Json
