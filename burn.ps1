<#
.SYNOPSIS
    OmniRoute Token Égető - Nagysebességű AI Token Égető

.DESCRIPTION
    Felesleges vagy lejáró AI tokenek gyors, párhuzamos és stabil elégetése OmniRoute-on keresztül.
    Támogatja a Web Dashboardot és a közvetlen CLI módot is.

.EXAMPLE
    .\burn.ps1
    (Megnyitja az interaktív menüt vagy a Web Dashboardot)

.EXAMPLE
    .\burn.ps1 -Web
    (Közvetlenül elindítja a Webes felületet és megnyitja a böngészőt)

.EXAMPLE
    .\burn.ps1 -Model "agy/gemini-3.8-flash-high" -Concurrency 16 -Mode target -Target 5000000
    (5.000.000 token elégetése CLI-ben 16 szálon)
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
Write-Host "      🔥 OMNIROUTE TOKEN ÉGETŐ (POWERSHELL) 🔥      " -ForegroundColor Yellow -BackgroundColor Black
Write-Host " ================================================= " -ForegroundColor Red
Write-Host ""

# Ha a -Web kapcsoló aktív, azonnal indítsuk a web szervert
if ($Web) {
    Write-Host "[*] Webes Irányítópult indítása: http://localhost:4420" -ForegroundColor Cyan
    Start-Process "http://localhost:4420"
    & node server.js
    exit
}

# Ha paraméterek nélkül hívták meg, interaktív választó
$isInteractive = (-not $PSBoundParameters.ContainsKey('Mode') -and -not $PSBoundParameters.ContainsKey('Model') -and -not $PSBoundParameters.ContainsKey('Target'))

if ($isInteractive) {
    Write-Host "Válassz indítási módot:" -ForegroundColor White
    Write-Host "  [1] Webes Irányítópult (Ajánlott, letisztult grafikus felület)" -ForegroundColor Green
    Write-Host "  [2] CLI égetés ebben az ablakban (Folyamatos égetés, Monster méret)" -ForegroundColor Cyan
    Write-Host "  [3] CLI égetés Token Cél alapján (pl. 1.000.000 token)" -ForegroundColor Yellow
    Write-Host "  [4] CLI égetés Időzített módban (pl. 30 perc)" -ForegroundColor Magenta
    Write-Host "  [Q] Kilépés" -ForegroundColor DarkGray
    Write-Host ""

    $choice = Read-Host "Választásod (1/2/3/4/Q)"
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
            $customTarget = Read-Host "Cél token mennyiség [Alapértelmezett: 1000000]"
            if ($customTarget -match '^\d+$') {
                $Target = [int]$customTarget
            }
        }
        "4" {
            $Mode = "duration"
            $customMinutes = Read-Host "Időtartam percben [Alapértelmezett: 30]"
            if ($customMinutes -match '^\d+$') {
                $DurationMinutes = [double]$customMinutes
            }
        }
        "Q" { exit }
        "q" { exit }
        default {
            Write-Host "Alapértelmezés: Webes Irányítópult indítása..." -ForegroundColor Cyan
            Start-Process "http://localhost:4420"
            & node server.js
            exit
        }
    }
}

# CLI futtatás node cli.js meghívásával
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
