@echo off
cd /d "%~dp0"
set "GAME_PORT=5189"
set "GAME_DATA_DIR=data/pg-game7"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 24 or newer before starting.
 pause
 exit /b 1
)
node -e "fetch('http://127.0.0.1:5189/api/health').then(r=>r.json()).then(d=>process.exit(d.ok&&d.release==='games-v3'?0:1)).catch(()=>process.exit(1))"
if not errorlevel 1 goto ready
if not exist node_modules call npm.cmd ci
if errorlevel 1 exit /b 1
call npm.cmd run game:build
if errorlevel 1 (
 pause
 exit /b 1
)
echo Open http://localhost:5189/games?game=missing-piece
echo Select Game 7 (Missing Piece) for the new room, or cue 14.01 in existing rooms.
if not exist data mkdir data
if not exist data\host-key.txt node -e "require('fs').writeFileSync('data/host-key.txt',require('crypto').randomBytes(16).toString('hex'))"
echo Host access key - copy into the host login:
type data\host-key.txt
echo.
call npm.cmd run game:start
exit /b
:ready
echo Game 7 is running: http://localhost:5189/games?game=missing-piece
timeout /t 2 >nul
start http://localhost:5189/games?game=missing-piece
