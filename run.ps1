# Tribute Grace Cooperative - System Launcher (PowerShell)
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "      TRIBUTE GRACE COOPERATIVE - LOAN SYSTEM LAUNCHER        " -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location -Path $PSScriptRoot

Write-Host "[1/3] Checking and clearing port 3003..." -ForegroundColor Yellow
$proc = Get-NetTCPConnection -LocalPort 3003 -ErrorAction SilentlyContinue
if ($proc) {
    foreach ($p in $proc) {
        Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Cleared previous instance on port 3003." -ForegroundColor Gray
}

if (-not (Test-Path "node_modules")) {
    Write-Host "[2/3] Installing npm packages..." -ForegroundColor Yellow
    npm install
}

Write-Host "[3/3] Starting server at http://localhost:3003..." -ForegroundColor Green
Write-Host ""
Write-Host "  - Officer Desk: http://localhost:3003/officer/dashboard" -ForegroundColor White
Write-Host "  - Admin Loans:  http://localhost:3003/admin/loans" -ForegroundColor White
Write-Host "  - Borrower App: http://localhost:3003/borrower/apply" -ForegroundColor White
Write-Host ""

Start-Sleep -Seconds 2
Start-Process "http://localhost:3003/officer/dashboard"

npm run dev -- -p 3003
