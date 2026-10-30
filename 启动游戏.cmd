@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if not errorlevel 1 (
  node.exe "%~dp0launch.mjs"
) else if exist "%ProgramFiles%\nodejs\node.exe" (
  "%ProgramFiles%\nodejs\node.exe" "%~dp0launch.mjs"
) else (
  echo Node.js was not found. Please run this script from the Codex environment or install Node.js.
  pause
  exit /b 1
)
if errorlevel 1 pause
endlocal
