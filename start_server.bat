@echo off
echo ========================================
echo    PDF Bookshelf Local Test Server
echo ========================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found, please install Python first
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Display Python version
echo [INFO] Detected Python version:
python --version

echo.
echo [INFO] Starting local server...
echo [INFO] Website URL: http://localhost:8000
echo [INFO] Press Ctrl+C to stop server
echo.

:: Try to auto-open browser (wait 2 seconds for server startup)
start /b timeout /t 2 /nobreak >nul && start http://localhost:8000

:: Start Python HTTP server
python -m http.server 8000

echo.
echo [INFO] Server stopped
pause