<#
.SYNOPSIS
  Installs a hidden logon autostart for the FLAMINGO demonstration supervisor.

.DESCRIPTION
  Creates a hidden VBS launcher in %LOCALAPPDATA%\flamingo-demo and registers a
  Scheduled Task that runs it when the current user signs in. If Scheduled Tasks
  are unavailable, it falls back to a shortcut in the user's Startup folder.

  The supervisor itself writes to %LOCALAPPDATA%\flamingo-demo\logs.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\demo\install-autostart.ps1
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'FLAMINGO Demo Supervisor',
  [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$supervisor = Join-Path $repoRoot 'scripts\demo\supervisor.mjs'
$runtime = Join-Path $env:LOCALAPPDATA 'flamingo-demo'
$launcher = Join-Path $runtime 'start-supervisor.vbs'

if (-not (Test-Path $supervisor)) {
  throw "Supervisor not found: $supervisor"
}

$node = (Get-Command node -ErrorAction Stop).Source

New-Item -ItemType Directory -Force -Path $runtime | Out-Null

$vbs = @"
' Launches the FLAMINGO demonstration supervisor with no console window.
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "$repoRoot"
shell.Run """$node"" ""$supervisor""", 0, False
"@
Set-Content -Path $launcher -Value $vbs -Encoding ASCII

Write-Host "Launcher written: $launcher"

$taskCommand = "wscript.exe `"$launcher`""
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

$registered = $false
if ($isAdmin) {
  schtasks.exe /Create /TN $TaskName /SC ONLOGON /DELAY 0000:20 /TR $taskCommand /RL LIMITED /F | Out-Null
  $registered = $LASTEXITCODE -eq 0
  if ($registered) {
    Write-Host "Scheduled Task registered: $TaskName (runs 20s after sign-in, hidden)"
  }
}

if (-not $registered) {
  $startup = [Environment]::GetFolderPath('Startup')
  Copy-Item -Path $launcher -Destination (Join-Path $startup 'FLAMINGO Demo Supervisor.vbs') -Force
  if (-not $isAdmin) {
    Write-Host 'Not elevated, so the Scheduled Task was skipped; installed a Startup folder launcher:'
  } else {
    Write-Host 'Scheduled Task creation failed; installed a Startup folder launcher instead:'
  }
  Write-Host "  $(Join-Path $startup 'FLAMINGO Demo Supervisor.vbs')"
}

if ($StartNow) {
  Get-Process -Name 'node' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $node } |
    ForEach-Object {
      $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
      if ($commandLine -like "*$supervisor*") {
        Write-Host "Supervisor already running (pid $($_.Id)); not starting a second one."
        $script:running = $true
      }
    }
  if (-not $script:running) {
    if ($registered) {
      schtasks.exe /Run /TN $TaskName | Out-Null
      Write-Host "Started Scheduled Task: $TaskName"
    } else {
      Start-Process -FilePath 'wscript.exe' -ArgumentList "`"$launcher`"" -WindowStyle Hidden
      Write-Host 'Started the Startup launcher.'
    }
  }
}

Write-Host ''
Write-Host 'The supervisor is not a service: it stops at sign-out, sleep, shutdown or power loss.'
Write-Host "Logs: $runtime\logs"
Write-Host "Remove with: powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\remove-autostart.ps1`""
