@echo off
set "GAME_ALREADY_RUNNING="
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Please install Node.js 24 or newer.
 pause
 exit /b 1
)
node -e "fetch('http://127.0.0.1:5180/api/health').then(r=>r.json()).then(d=>process.exit(d.ok&&(d.game==='human-vs-ai'||d.game==='trust-tug')?0:1)).catch(()=>process.exit(1))"
if not errorlevel 1 (
 set "GAME_ALREADY_RUNNING=1"
 goto ready
)
if not exist node_modules call npm.cmd ci
if errorlevel 1 exit /b 1
call npm.cmd run game:build
if errorlevel 1 (
 pause
 exit /b 1
)
if not exist data mkdir data
if not exist data\host-key.txt node -e "require('fs').writeFileSync('data/host-key.txt',require('crypto').randomBytes(16).toString('hex'))"
:ready
echo.
echo Host access key - copy this into the host login:
type data\host-key.txt
echo.
echo Open http://localhost:5180/games
echo For mobile testing, use the LAN URL printed by the server.
if defined GAME_ALREADY_RUNNING (
 echo The game server is already running. Use the URL above.
 pause
 exit /b 0
)
call npm.cmd run game:start
