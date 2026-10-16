<#
.SYNOPSIS
    OmniRoute Token Burner - High-Velocity AI Token Incinerator

.DESCRIPTION
    Fast, reliable, and parallel AI token burner for OmniRoute environments.
    Supports both Web Dashboard and CLI modes.

.EXAMPLE
    .\burn.ps1
    (Opens interactive menu or Web Dashboard)

.EXAMPLE
    .\burn.ps1 -Web
    (Launches Web UI and opens the browser)

.EXAMPLE
    .\burn.ps1 -Model "agy/gemini-3.8-flash-high" -Concurrency 16 -Mode target -Target 5000000
    (Burns 5,000,000 tokens in CLI with 16 threads)
#>

[CmdletBinding()]
param(
    [switch]$Web,
    [string]$Model = "agy/gemini-3.8-flash-high",
    [int]$Concurrency = 8,
    [ValidateSet("infinite", "target", "duration")]
    [string]$Mode = "infinite",
    [int]$Target = 1000000,
    [double]$DurationMinutes = 30,
    [ValidateSet("monster", "large", "normal")]
    [string]$Size = "monster",
    [string]$ApiKey = "",
    [string]$BaseUrl = "http://localhost:20128/v1"
)

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host " ================================================= " -ForegroundColor Red
Write-Host "      🔥 OMNIROUTE TOKEN BURNER (POWERSHELL) 🔥      " -ForegroundColor Yellow -BackgroundColor Black
Write-Host " ================================================= " -ForegroundColor Red
Write-Host ""

# Launch web dashboard directly if -Web switch is passed
if ($Web) {
    Write-Host "[*] Launching Web Dashboard: http://localhost:4420" -ForegroundColor Cyan
    Start-Process "http://localhost:4420"
    & node server.js
    exit
}

# Interactive selection if called without arguments
$isInteractive = (-not $PSBoundParameters.ContainsKey('Mode') -and -not $PSBoundParameters.ContainsKey('Model') -and -not $PSBoundParameters.ContainsKey('Target'))

if ($isInteractive) {
    Write-Host "Select execution mode:" -ForegroundColor White
    Write-Host "  [1] Open Web Dashboard (Recommended, polished UI)" -ForegroundColor Green
    Write-Host "  [2] CLI Continuous Burn in this terminal (Monster size)" -ForegroundColor Cyan
    Write-Host "  [3] CLI Token Target Burn (e.g. 1,000,000 tokens)" -ForegroundColor Yellow
    Write-Host "  [4] CLI Timed Duration Burn (e.g. 30 minutes)" -ForegroundColor Magenta
    Write-Host "  [Q] Exit" -ForegroundColor DarkGray
    Write-Host ""

    $choice = Read-Host "Choice (1/2/3/4/Q)"
    switch ($choice.Trim()) {
        "1" {
            Start-Process "http://localhost:4420"
            & node server.js
            exit
        }
        "2" {
            $Mode = "infinite"
        }
        "3" {
            $Mode = "target"
            $customTarget = Read-Host "Target token count [Default: 1000000]"
            if ($customTarget -match '^\d+$') {
                $Target = [int]$customTarget
            }
        }
        "4" {
            $Mode = "duration"
            $customMinutes = Read-Host "Duration in minutes [Default: 30]"
            if ($customMinutes -match '^\d+$') {
                $DurationMinutes = [double]$customMinutes
            }
        }
        "Q" { exit }
        "q" { exit }
        default {
            Write-Host "Defaulting to Web Dashboard..." -ForegroundColor Cyan
            Start-Process "http://localhost:4420"
            & node server.js
            exit
        }
    }
}

# Execute CLI mode
$nodeArgs = @(
    "cli.js",
    "--model", $Model,
    "--concurrency", $Concurrency,
    "--mode", $Mode,
    "--target", $Target,
    "--duration", $DurationMinutes,
    "--size", $Size,
    "--url", $BaseUrl
)
if ($ApiKey) {
    $nodeArgs += @("--key", $ApiKey)
}

& node $nodeArgs
