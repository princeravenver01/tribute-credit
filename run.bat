@echo off
setlocal
cd /d "%~dp0"
title Tribute Grace Cooperative Server

echo ==============================================================
echo       TRIBUTE GRACE COOPERATIVE - LOAN SYSTEM LAUNCHER
echo ==============================================================
echo.

:: 1. Force kill any previous process on port 3003
echo [1/3] Clearing port 3003...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3003 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: 2. Launch browser
echo [2/3] Opening browser at http://localhost:3003...
start "" http://localhost:3003/officer/dashboard

:: 3. Run Next.js server directly
echo [3/3] Starting server on port 3003...
echo.
echo ==============================================================
echo App is running! Keep this window open. Press Ctrl+C to stop.
echo ==============================================================
echo.

node node_modules\next\dist\bin\next dev -p 3003

echo.
echo Server has ended.
pause
