@echo off
echo ====================================================
echo Starting MySQL Service for Solar CRM...
echo ====================================================

:: Check if running with Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Elevating privileges to start MySQL80 service...
    powershell -Command "Start-Process cmd -ArgumentList '/c net start MySQL80 & echo. & echo MySQL service started successfully! & pause' -Verb RunAs"
    exit /b
)

net start MySQL80
echo.
echo MySQL service started successfully!
pause
