# Windows Task Scheduler: benzin-price import every 2 hours (local dev DB).
# Run as Administrator once:
#   cd C:\Users\user\.cursor\fuel-map\scripts
#   powershell -ExecutionPolicy Bypass -File install-import-scheduler.ps1

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ScriptsDir = Join-Path $ProjectRoot 'scripts'
$TaskName = 'FuelMap-BenzinPriceImport'
$LogFile = Join-Path $ProjectRoot 'logs\benzin-import.log'

New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null

$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-Command',
  @"
Set-Location '$ScriptsDir'
`$env:DATABASE_URL = 'postgresql://fuelmap:fuelmap_secret@localhost:5432/fuelmap'
npm run import:benzin-price -- --region all --delay 2000 --match-radius 250 *>> '$LogFile' 2>&1
"@
) -WorkingDirectory $ScriptsDir

$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration ([TimeSpan]::MaxValue)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Description 'Fuel map: import fuel prices every 2 hours' -Force

Write-Host "Task registered: $TaskName (every 2 hours)"
Write-Host "Log: $LogFile"
Write-Host "Run now: Start-ScheduledTask -TaskName '$TaskName'"
