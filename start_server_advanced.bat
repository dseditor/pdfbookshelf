@echo off
title PDF Bookshelf Local Test Server

echo.
echo ========================================
echo       PDF Bookshelf Local Server       
echo ========================================
echo.

:: Check if current directory is correct
if not exist "index.html" (
    echo [ERROR] index.html not found in current directory
    echo Please ensure this BAT file is in the PDF Bookshelf project root
    pause
    exit /b 1
)

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found
    echo.
    echo Please install Python 3.6 or higher:
    echo 1. Go to https://www.python.org/downloads/
    echo 2. Download and install the latest Python version
    echo 3. Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

:: Display system information
echo [INFO] Detected Python version:
python --version
echo.

:: Check if port is already in use
netstat -an | find ":8000" >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 8000 may already be in use
    echo If you encounter errors, try closing other applications using this port
    echo.
)

:: Display project file structure
echo [INFO] Project files check:
if exist "index.html" echo + index.html found
if exist "bento-script.js" echo + bento-script.js found
if exist "bento-styles.css" echo + bento-styles.css found
if exist "PDF\" echo + PDF folder found
if not exist "PDF\" echo - PDF folder missing
echo.

echo [INFO] Starting local server...
echo.
echo ----------------------------------------
echo   Website URL: http://localhost:8000   
echo   Local Path: %CD%                    
echo   Stop Server: Press Ctrl+C             
echo   Restart: Close and run this file again
echo ----------------------------------------
echo.

:: Try to auto-open browser
echo [INFO] Opening browser...
start "" "http://localhost:8000"

:: Wait a bit for browser to start
timeout /t 2 /nobreak >nul

echo [INFO] Server started, please check your browser
echo.

:: Start Python HTTP server
python -m http.server 8000

echo.
echo ========================================
echo [INFO] Server has stopped running
echo ========================================
pause