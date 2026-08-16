@echo off
echo ===============================
echo   LIQUIDITY LAB STARTING...
echo ===============================
:: Start Local API Server (dev only)
echo Starting API...
start cmd /k "cd /d C:\Dev\liquidity-lab\Server && node server.js"
echo ===============================
echo   API LAUNCHED
echo   Bot managed by PM2
echo   Frontend on Vercel
echo ===============================
pause