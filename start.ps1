<#
.SYNOPSIS
    Elindítja az OmniRoute Token Égető Webes Irányítópultját.
#>

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host " ================================================= " -ForegroundColor Red
Write-Host "      🔥 OMNIROUTE TOKEN ÉGETŐ SZERVER 🔥          " -ForegroundColor Yellow -BackgroundColor Black
Write-Host " ================================================= " -ForegroundColor Red
Write-Host ""
Write-Host "[*] Webes Irányítópult megnyitása: http://localhost:4420..." -ForegroundColor Cyan
Write-Host "[*] Leállításhoz nyomj Ctrl+C-t ebben az ablakban, vagy futtasd a .\stop.ps1 parancsot." -ForegroundColor DarkYellow
Write-Host ""

Start-Process "http://localhost:4420"
& node server.js
