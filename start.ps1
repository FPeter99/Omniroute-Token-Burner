<#
.SYNOPSIS
    Starts the OmniRoute Token Burner Web Server and opens the Dashboard.
#>

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host " ================================================= " -ForegroundColor Red
Write-Host "      🔥 OMNIROUTE TOKEN BURNER WEB SERVER 🔥      " -ForegroundColor Yellow -BackgroundColor Black
Write-Host " ================================================= " -ForegroundColor Red
Write-Host ""
Write-Host "[*] Launching Web UI at http://localhost:4420..." -ForegroundColor Cyan
Write-Host "[*] Press Ctrl+C in this window or run .\stop.ps1 to stop the server." -ForegroundColor DarkYellow
Write-Host ""

Start-Process "http://localhost:4420"
& node server.js
