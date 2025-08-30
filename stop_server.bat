@echo off
echo ========================================
echo   Stop PDF Bookshelf Local Server
echo ========================================
echo.

echo [INFO] Looking for and stopping Python server on port 8000...

:: Find and terminate processes using port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do (
    echo [INFO] Found process PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [SUCCESS] Stopped process %%a
    ) else (
        echo [ERROR] Cannot stop process %%a
    )
)

echo.
echo [INFO] Operation completed
timeout /t 3 /nobreak >nul