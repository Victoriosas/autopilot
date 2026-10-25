# Creates a disposable local fixture project. Never links, pushes or resets a remote database.
param([switch]$PrepareOnly)
$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$sources = @(
    @{ Source = 'tests/commerce-baseline.sql'; Target = '20261010000000_synthetic_commerce_baseline.sql' },
    @{ Source = 'tests/commerce-supabase-access.sql'; Target = '20261010000001_synthetic_commerce_access.sql' },
    @{ Source = 'tests/catalog-archive-supabase.sql'; Target = '20261010000002_synthetic_catalog_archive.sql' },
    @{ Source = 'tests/supplier-publication-supabase.sql'; Target = '20261010000003_synthetic_supplier_publication.sql' },
    @{ Source = 'supabase/migrations/20261011050519_explicit_data_api_grants.sql'; Target = '20261011050519_explicit_data_api_grants.sql' },
    @{ Source = 'supabase/migrations/20261011114131_revoke_catalog_archive_public_execute.sql'; Target = '20261011114131_revoke_catalog_archive_public_execute.sql' },
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
if (-not $PrepareOnly) {
    & npx --yes supabase@2.120.0 init --workdir $workspace
    if ($LASTEXITCODE -ne 0) { throw "Supabase initialization failed. Workspace preserved: $workspace" }
}
$migrations = Join-Path $workspace 'supabase/migrations'
New-Item -ItemType Directory -Path $migrations -Force | Out-Null
foreach ($entry in $sources) {
    $source = Join-Path $repository $entry.Source
    $destination = Join-Path $migrations $entry.Target
    Copy-Item -LiteralPath $source -Destination $destination
    # Native .NET works in minimal PowerShell hosts without the Get-FileHash module.
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try {
        $sourceHash = [BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($source)))
        $destinationHash = [BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($destination)))
    } finally { $hasher.Dispose() }
    if ($sourceHash -ne $destinationHash) {
        throw "Fixture copy verification failed: $($entry.Source)"
    }
}
[ordered]@{
    workspace = $workspace
    cliVersion = '2.120.0'
    syntheticMigrations = $sources.Count
    stackStarted = $false
    cliInitialized = -not [bool]$PrepareOnly
    prerequisite = 'Docker daemon; no production credentials or project linking'
    nextCommand = if ($PrepareOnly) { "npx --yes supabase@2.120.0 init --workdir '$workspace'" } else { "npx --yes supabase@2.120.0 start --workdir '$workspace'" }
} | ConvertTo-Json
