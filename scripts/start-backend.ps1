param(
  [switch]$Reseed
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Title,
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [string[]]$Arguments = @()
  )

  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Cyan
  & $Command @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "$Title failed with exit code $LASTEXITCODE"
  }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nodeModulesPath = Join-Path $projectRoot "node_modules"
$prismaClientPath = Join-Path $projectRoot "node_modules\.prisma\client"
$dbPath = Join-Path $projectRoot "prisma\dev.db"

Set-Location $projectRoot

Write-Host "Project root: $projectRoot" -ForegroundColor Green

$runningProjectProcesses = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq "node.exe" -and
    $_.CommandLine -and
    $_.CommandLine.Contains($projectRoot) -and
    (
      $_.CommandLine.Contains("ts-node-dev") -or
      $_.CommandLine.Contains("src/main.ts") -or
      $_.CommandLine.Contains("npm-cli.js run start:dev")
    )
  }

if ($runningProjectProcesses) {
  $processIds = $runningProjectProcesses.ProcessId
  Write-Host "Stopping existing backend processes: $($processIds -join ', ')" -ForegroundColor Yellow
  Stop-Process -Id $processIds -Force
  Start-Sleep -Seconds 1
}

if (-not (Test-Path $nodeModulesPath)) {
  Invoke-Step -Title "Install dependencies" -Command "npm.cmd" -Arguments @("install")
}

if (Test-Path $prismaClientPath) {
  Get-ChildItem -Path $prismaClientPath -Filter "query_engine-windows.dll.node.tmp*" -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue
}

$dbExistsBeforeStartup = Test-Path $dbPath

Invoke-Step -Title "Generate Prisma Client" -Command "npx.cmd" -Arguments @("prisma", "generate")
Invoke-Step -Title "Apply database migrations" -Command "npx.cmd" -Arguments @("prisma", "migrate", "deploy")

if ($Reseed -or -not $dbExistsBeforeStartup) {
  Invoke-Step -Title "Seed initial data" -Command "npm.cmd" -Arguments @("run", "prisma:seed")
} else {
  Write-Output ""
  Write-Output "==> Skip seed"
  Write-Output "Existing database detected. Current data is preserved. Use -Reseed to reset demo data."
}

Write-Host ""
Write-Host "==> Start backend dev server" -ForegroundColor Cyan
& "npm.cmd" "run" "start:dev"

if ($LASTEXITCODE -ne 0) {
  throw "Failed to start backend dev server with exit code $LASTEXITCODE"
}
