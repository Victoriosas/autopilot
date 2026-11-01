$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if ((Test-Path '.env') -or (Test-Path '.env.local')) {
  throw 'Esta copia de revision debe permanecer sin archivos .env ni .env.local.'
}
# Solo modifica el entorno del proceso de revision, nunca las credenciales guardadas.
Get-ChildItem Env: | Where-Object { $_.Name -match '^(SUPABASE_|VITE_SUPABASE_|RESEND_|CAMELAI_|GEMINI_|GOOGLE_API_KEY$|OPENAI_|OPENROUTER_|CJ_|PAYPAL_|MERCADO|AUTOPILOT_ADMIN_TOKEN$|AUTOPILOT_CODEX_TOKEN$|CONSULTATION_)' } | Remove-Item
$env:NODE_ENV = 'development'
$env:HOST = '127.0.0.1'
$env:CHECKOUT_ENABLED = 'false'
$env:AUTOPILOT_LEGACY_SOURCING_ENABLED = 'false'
$env:AUTOPILOT_V4_SOURCING_ENABLED = 'false'
$env:AUTOPILOT_SHADOW_MODE = 'true'
$env:COMMERCE_MAINTENANCE_CRON_ENABLED = 'false'
$env:CONSULTATION_REQUESTS_ENABLED = 'false'
$env:CONSULTATION_MAIL_ENABLED = 'false'
$env:CONSULTATION_INTELLIGENCE_ENABLED = 'false'
$env:CONSULTATION_MODEL_GATEWAY_ENABLED = 'false'
Write-Host 'Victoriosas: revision local en http://127.0.0.1:3000. Borradores visibles; sin servicios externos configurados.'
npm.cmd run dev
