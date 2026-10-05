$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repositoryRoot

if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
  throw 'k6 is not installed or is not available on PATH.'
}

$k6ConfigPath = Join-Path $env:APPDATA 'k6\config.json'
$hasEnvironmentCredentials = [bool]$env:K6_CLOUD_TOKEN -and [bool]$env:K6_CLOUD_STACK_ID
$hasSavedCredentials = Test-Path -LiteralPath $k6ConfigPath
if (($env:K6_CLOUD_TOKEN -or $env:K6_CLOUD_STACK_ID) -and -not $hasEnvironmentCredentials) {
  Write-Output 'Set both K6_CLOUD_TOKEN and K6_CLOUD_STACK_ID, or remove both and authenticate with `k6 cloud login`.'
  exit 2
}
if (-not $hasEnvironmentCredentials -and -not $hasSavedCredentials) {
  Write-Output 'Grafana k6 Cloud is not authenticated. Run `k6 cloud login` once, then run this script again. Do not put the token in this project.'
  exit 2
}

& k6 cloud run `
  --summary-mode full `
  -e 'BASE_URL=https://nuvanti-shop.pages.dev' `
  'load-tests/store-browsing.js'

exit $LASTEXITCODE
