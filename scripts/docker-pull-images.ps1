#Requires -Version 5.1
<#
.SYNOPSIS
  Prefetch Docker images for fuel-map (PostGIS, Node, Nginx).
  Tries Docker Hub first, then DaoCloud mirror (useful in RU when Hub returns EOF).
#>
param(
  [string]$MirrorPrefix = 'docker.m.daocloud.io/'
)

$ErrorActionPreference = 'Stop'

function Invoke-DockerPull {
  param([Parameter(Mandatory)][string]$Image)
  Write-Host "Pulling $Image..." -ForegroundColor Cyan
  docker pull $Image
  if ($LASTEXITCODE -ne 0) {
    throw "docker pull exited with code $LASTEXITCODE"
  }
}

function Get-MirrorImage {
  param([Parameter(Mandatory)][string]$Image)
  if ($Image.StartsWith($MirrorPrefix)) { return $Image }
  if ($Image -notmatch '/') {
    return "${MirrorPrefix}library/$Image"
  }
  return "${MirrorPrefix}$Image"
}

function Pull-ImageWithFallback {
  param(
    [Parameter(Mandatory)][string]$Image,
    [string]$TagAs
  )
  try {
    Invoke-DockerPull -Image $Image
    Write-Host "OK (direct): $Image" -ForegroundColor Green
    return
  } catch {
    Write-Host "Direct pull failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  $mirror = Get-MirrorImage -Image $Image
  Write-Host "Trying mirror: $mirror" -ForegroundColor Yellow
  Invoke-DockerPull -Image $mirror
  Write-Host "OK (mirror): $mirror" -ForegroundColor Green

  if ($TagAs -and ($TagAs -ne $Image)) {
    docker tag $mirror $TagAs
    if ($LASTEXITCODE -ne 0) { throw "docker tag failed: $mirror -> $TagAs" }
    Write-Host "Tagged as $TagAs" -ForegroundColor Green
  }
}

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$PostgisImage = $env:POSTGIS_IMAGE
if (-not $PostgisImage -and (Test-Path (Join-Path $Root '.env'))) {
  Get-Content (Join-Path $Root '.env') | ForEach-Object {
    if ($_ -match '^\s*POSTGIS_IMAGE\s*=\s*(.+)\s*$') {
      $PostgisImage = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}
if (-not $PostgisImage) { $PostgisImage = 'postgis/postgis:16-3.4' }

$canonicalPostgis = 'postgis/postgis:16-3.4'
$tagPostgisAs = if ($PostgisImage -eq $canonicalPostgis) { $canonicalPostgis } else { $null }

Write-Host '=== Fuel Map: prefetch Docker images ===' -ForegroundColor Cyan
Write-Host "Directory: $Root"
Write-Host "POSTGIS_IMAGE: $PostgisImage"

$images = @(
  @{ Image = $PostgisImage; TagAs = $tagPostgisAs },
  @{ Image = 'node:22-alpine'; TagAs = $null },
  @{ Image = 'nginx:alpine'; TagAs = $null }
)

$failed = @()
foreach ($entry in $images) {
  try {
    Pull-ImageWithFallback -Image $entry.Image -TagAs $entry.TagAs
  } catch {
    Write-Host "FAILED: $($entry.Image) — $($_.Exception.Message)" -ForegroundColor Red
    $failed += $entry.Image
  }
}

if ($failed.Count -gt 0) {
  Write-Host ''
  Write-Host 'Could not pull all images. Try:' -ForegroundColor Red
  Write-Host '  1) POSTGIS_IMAGE=docker.m.daocloud.io/postgis/postgis:16-3.4 in .env'
  Write-Host '  2) VPN or stable DNS, then re-run this script'
  Write-Host '  3) Docker Desktop -> Settings -> Docker Engine -> registry-mirrors'
  exit 1
}

Write-Host ''
Write-Host 'All images ready. Run: docker compose up -d --build' -ForegroundColor Green
