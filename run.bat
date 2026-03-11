@echo off
title Frontend Runner
echo ==========================================
echo       Starting Frontend Web System
echo ==========================================

REM Go to frontend directory
cd /d "%~dp0frontend"

echo [1/2] Installing Dependencies...
call npm install

REM Read PORT from .env (if it exists)
for /f "tokens=1* delims==" %%a in (.env) do (
    if "%%a"=="PORT" set FRONTEND_PORT=%%b
)

REM Default port if not found in .env
if "%FRONTEND_PORT%"=="" set FRONTEND_PORT=3000

echo [2/2] Starting Server on Port %FRONTEND_PORT%...
set PORT=%FRONTEND_PORT%
call npm start

echo.
echo ==========================================
echo       Server Stopped. Cleaning up...
echo ==========================================
echo Removing node_modules...
rmdir /s /q node_modules

pause

