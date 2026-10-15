$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -LiteralPath $PSScriptRoot

Write-Host "🔥 OmniRoute Token Burner Web Server indítása..." -ForegroundColor Red
Start-Process "http://localhost:4420"
& node server.js
