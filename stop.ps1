<#
.SYNOPSIS
    Leállítja az OmniRoute Token Égető web szervert és a háttérfolyamatokat.
#>

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -LiteralPath $PSScriptRoot

Write-Host "🛑 OmniRoute Token Égető leállítása..." -ForegroundColor Yellow

$stopped = $false

# 1. Kísérlet a szabályos HTTP leállításra
try {
    $res = Invoke-RestMethod -Uri "http://localhost:4420/api/shutdown" -Method Post -TimeoutSec 2 -ErrorAction Stop
    if ($res.success) {
        Write-Host "✓ Szabályos leállítási jelzés sikeresen elküldve." -ForegroundColor Green
        $stopped = $true
    }
}
catch {
    # A szerver már leállhatott vagy nem válaszol
}

Start-Sleep -Milliseconds 600

# 2. Bármilyen megmaradt folyamat lezárása a 4420-as porton
$conns = Get-NetTCPConnection -LocalPort 4420 -ErrorAction SilentlyContinue
if ($conns) {
    $procIds = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pidToKill in $procIds) {
        if ($pidToKill -gt 0) {
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            Write-Host "✓ Folyamat leállítva (PID: $pidToKill)" -ForegroundColor Green
            $stopped = $true
        }
    }
}

if ($stopped) {
    Write-Host "🔥 A Token Égető sikeresen és teljesen leállt." -ForegroundColor Green
} else {
    Write-Host "ℹ Nincs futó Token Égető folyamat a 4420-as porton." -ForegroundColor Cyan
}
