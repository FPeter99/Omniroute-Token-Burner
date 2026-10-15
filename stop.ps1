<#
.SYNOPSIS
    Stops the OmniRoute Token Burner web server and active background processes.
#>

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -LiteralPath $PSScriptRoot

Write-Host "🛑 Stopping OmniRoute Token Burner..." -ForegroundColor Yellow

$stopped = $false

# 1. Try graceful HTTP shutdown
try {
    $res = Invoke-RestMethod -Uri "http://localhost:4420/api/shutdown" -Method Post -TimeoutSec 2 -ErrorAction Stop
    if ($res.success) {
        Write-Host "✓ Graceful shutdown signal sent successfully." -ForegroundColor Green
        $stopped = $true
    }
}
catch {
    # Server might not be responding or already stopping
}

Start-Sleep -Milliseconds 600

# 2. Terminate any remaining process listening on port 4420
$conns = Get-NetTCPConnection -LocalPort 4420 -ErrorAction SilentlyContinue
if ($conns) {
    $procIds = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pidToKill in $procIds) {
        if ($pidToKill -gt 0) {
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            Write-Host "✓ Terminated process ID: $pidToKill" -ForegroundColor Green
            $stopped = $true
        }
    }
}

if ($stopped) {
    Write-Host "🔥 Token Burner has been completely stopped." -ForegroundColor Green
} else {
    Write-Host "ℹ No active Token Burner process found on port 4420." -ForegroundColor Cyan
}
