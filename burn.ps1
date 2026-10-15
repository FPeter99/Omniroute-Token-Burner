<#
.SYNOPSIS
    OmniRoute Token Burner - Nagysebességű AI Token Égető

.DESCRIPTION
    Felesleges AI tokenek gyors elégetése OmniRoute-on keresztül.
    Támogatja a Web Dashboardot és a közvetlen CLI módot is.

.EXAMPLE
    .\burn.ps1
    (Megnyitja az interaktív menüt vagy a Web Dashboardot)

.EXAMPLE
    .\burn.ps1 -Web
    (Közvetlenül elindítja a Web UI szervert és megnyitja a böngészőt)

.EXAMPLE
    .\burn.ps1 -Model "auto/fast" -Concurrency 12 -Mode target -Target 500000
    (500.000 token elégetése CLI-ben 12 szálon)
#>

[CmdletBinding()]
param(
    [switch]$Web,
    [string]$Model = "auto/fast",
    [int]$Concurrency = 8,
    [ValidateSet("infinite", "target", "duration")]
    [string]$Mode = "infinite",
    [int]$Target = 1000000,
    [double]$DurationHours = 6,
    [string]$Strategy = "prompt_heavy",
    [double]$Multiplier = 1.0,
    [string]$Pool = "",
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

# Ha $Web kapcsoló aktív, indítsuk a web szervert
if ($Web) {
    Write-Host "[*] Web Dashboard indítása: http://localhost:4420" -ForegroundColor Cyan
    Start-Process "http://localhost:4420"
    & node server.js
    exit
}

# Ha paraméterek nélkül hívták meg, kérdezzük meg a módot
$isInteractive = (-not $PSBoundParameters.ContainsKey('Mode') -and -not $PSBoundParameters.ContainsKey('Model') -and -not $PSBoundParameters.ContainsKey('Target'))

if ($isInteractive) {
    Write-Host "Válassz indítási módot:" -ForegroundColor White
    Write-Host "  [1] Web Dashboard megnyitása (Ajánlott, szép felület)" -ForegroundColor Green
    Write-Host "  [2] CLI égetés ebben a PowerShell ablakban (Folyamatos)" -ForegroundColor Cyan
    Write-Host "  [3] CLI égetés Token Cél alapján (pl. 1.000.000 token)" -ForegroundColor Yellow
    Write-Host "  [4] CLI égetés Időzített módban (pl. 6 óra)" -ForegroundColor Magenta
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
            $customHours = Read-Host "Időtartam órában [Alapértelmezett: 6]"
            if ($customHours -as [double]) {
                $DurationHours = [double]$customHours
            }
        }
        "Q" { exit }
        "q" { exit }
        default {
            Write-Host "Alapértelmezés: Web Dashboard indítása..." -ForegroundColor Cyan
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
    "--duration", $DurationHours,
    "--strategy", $Strategy,
    "--multiplier", $Multiplier,
    "--url", $BaseUrl
)
if ($Pool) {
    $nodeArgs += @("--pool", $Pool)
}
if ($ApiKey) {
    $nodeArgs += @("--key", $ApiKey)
}

& node $nodeArgs
