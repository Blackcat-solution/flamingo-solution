<#
.SYNOPSIS
  Removes the FLAMINGO demonstration supervisor autostart and stops it.

.DESCRIPTION
  Deletes the logon Scheduled Task and the Startup folder launcher, then stops
  the running supervisor process tree. Logs are kept.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\demo\remove-autostart.ps1
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'FLAMINGO Demo Supervisor'
)

$ErrorActionPreference = 'Stop'

$runtime = Join-Path $env:LOCALAPPDATA 'flamingo-demo'
$lockFile = Join-Path $runtime 'supervisor.lock'
$startupLauncher = Join-Path ([Environment]::GetFolderPath('Startup')) 'FLAMINGO Demo Supervisor.vbs'

schtasks.exe /Delete /TN $TaskName /F 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Scheduled Task removed: $TaskName"
} else {
  Write-Host "Scheduled Task not present: $TaskName"
}

if (Test-Path $startupLauncher) {
  Remove-Item -Path $startupLauncher -Force
  Write-Host 'Startup folder launcher removed.'
}

if (Test-Path $lockFile) {
  try {
    $pidFromLock = (Get-Content -Path $lockFile -Raw | ConvertFrom-Json).pid
  } catch {
    $pidFromLock = [int]((Get-Content -Path $lockFile -Raw).Trim().Split(' ')[0])
  }
  if ($pidFromLock) {
    taskkill.exe /PID $pidFromLock /T /F 2>$null | Out-Null
    Write-Host "Stopped supervisor process tree (pid $pidFromLock)."
  }
  Remove-Item -Path $lockFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Logs kept in: $runtime\logs"
