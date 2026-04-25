@echo off
echo ===============================
echo   LIQUIDITY LAB STARTING...
echo ===============================

:: Start API Server
echo Starting API...
start cmd /k "cd /d C:\Dev\liquidity-lab\server && node server.js"

:: Start Frontend (Vite)
echo Starting Frontend...
start cmd /k "cd /d C:\Dev\liquidity-lab\client && npm run dev"

:: Start Python Bot
echo Starting Bot...
start cmd /k "cd /d C:\Dev\liquidity-lab\server && python BOTFINAL.py"

echo ===============================
echo   ALL SYSTEMS LAUNCHED 🚀
echo ===============================
pause