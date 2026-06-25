#Requires -Version 5.1
<#
.SYNOPSIS
  Local fuel-map dev on Windows without Docker pull (PostgreSQL + npm).
.EXAMPLE
  .\scripts\start-windows-dev.ps1
.EXAMPLE
  .\scripts\start-windows-dev.ps1 -StartServers
#>
param(
  [switch]$StartServers,
  [string]$DatabaseUrl = 'postgresql://fuelmap:fuelmap_secret@localhost:5432/fuelmap'
)

$ErrorActionPreference = 'Stop'

function Find-Psql {
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    'C:\Program Files\PostgreSQL\17\bin\psql.exe',
    'C:\Program Files\PostgreSQL\16\bin\psql.exe',
    'C:\Program Files\PostgreSQL\15\bin\psql.exe'
  )
  foreach ($path in $candidates) {
    if (Test-Path $path) { return $path }
  }
  return $null
}

function Test-PostgresConnection {
  param([string]$PsqlPath, [string]$Url)
  $env:PGPASSWORD = 'fuelmap_secret'
  try {
    & $PsqlPath -U fuelmap -h localhost -p 5432 -d fuelmap -c 'SELECT 1 AS ok;' 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'

Write-Host '=== fuel-map: Windows dev (no Docker) ===' -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js not found. Install from https://nodejs.org/ and reopen the terminal.'
}

$nodeVer = node --version
Write-Host "Node: $nodeVer" -ForegroundColor Green

$psqlPath = Find-Psql
if (-not $psqlPath) {
  Write-Host ''
  Write-Host 'PostgreSQL (psql) not found in PATH or default install paths.' -ForegroundColor Red
  Write-Host 'Install PostgreSQL 16 + PostGIS: https://www.postgresql.org/download/windows/' -ForegroundColor Yellow
  Write-Host 'Full guide: docs/WINDOWS-NO-DOCKER.md' -ForegroundColor Yellow
  exit 1
}

Write-Host "psql: $psqlPath" -ForegroundColor Green

if (-not (Test-PostgresConnection -PsqlPath $psqlPath -Url $DatabaseUrl)) {
  Write-Host ''
  Write-Host 'Cannot connect to PostgreSQL as fuelmap@localhost:5432/fuelmap.' -ForegroundColor Red
  Write-Host 'Create DB and user — see docs/WINDOWS-NO-DOCKER.md (section 3).' -ForegroundColor Yellow
  exit 1
}

Write-Host 'PostgreSQL: connection OK' -ForegroundColor Green

$env:DATABASE_URL = $DatabaseUrl

foreach ($dir in @($Backend, $Frontend)) {
  if (-not (Test-Path (Join-Path $dir 'node_modules'))) {
    Write-Host "npm install in $dir ..." -ForegroundColor Cyan
    Push-Location $dir
    try {
      npm install
      if ($LASTEXITCODE -ne 0) { throw "npm install failed in $dir" }
    } finally {
      Pop-Location
    }
  }
}

Write-Host 'Running migrations...' -ForegroundColor Cyan
Push-Location $Backend
try {
  npm run migrate
  if ($LASTEXITCODE -ne 0) { throw 'migrate failed' }

  Write-Host 'Seeding Moscow test stations...' -ForegroundColor Cyan
  npm run seed
  if ($LASTEXITCODE -ne 0) { throw 'seed failed' }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Database ready.' -ForegroundColor Green

if ($StartServers) {
  $backendCmd = "Set-Location '$Backend'; `$env:DATABASE_URL='$DatabaseUrl'; npm run dev"
  $frontendCmd = "Set-Location '$Frontend'; npm run dev"

  Start-Process pwsh -ArgumentList @('-NoExit', '-Command', $backendCmd)
  Start-Sleep -Seconds 2
  Start-Process pwsh -ArgumentList @('-NoExit', '-Command', $frontendCmd)

  Write-Host 'Started backend (3001) and frontend (5173) in new windows.' -ForegroundColor Green
  Write-Host 'Open: http://127.0.0.1:5173' -ForegroundColor Cyan
} else {
  Write-Host 'Start two terminals:' -ForegroundColor Yellow
  Write-Host ''
  Write-Host "  cd `"$Backend`"" -ForegroundColor White
  Write-Host "  `$env:DATABASE_URL = `"$DatabaseUrl`"" -ForegroundColor White
  Write-Host '  npm run dev' -ForegroundColor White
  Write-Host ''
  Write-Host "  cd `"$Frontend`"" -ForegroundColor White
  Write-Host '  npm run dev' -ForegroundColor White
  Write-Host ''
  Write-Host 'Map: http://127.0.0.1:5173' -ForegroundColor Cyan
  Write-Host 'Or re-run: .\scripts\start-windows-dev.ps1 -StartServers' -ForegroundColor DarkGray
}
