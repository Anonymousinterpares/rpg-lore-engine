@echo off
start "RPG Server" /min cmd /c "npx tsx server.ts"
npm run dev
taskkill /FI "WINDOWTITLE eq RPG Server" /F >nul 2>&1
