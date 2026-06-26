@echo off
echo ========================================
echo HRMS Accountant Setup
echo ========================================
echo.

echo Step 1: Initializing Accountant User...
python init_accountant.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to initialize accountant user
    pause
    exit /b 1
)

echo.
echo Step 2: Verifying Setup...
python verify_accountant_setup.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo WARNING: Some verification checks failed
    echo Please review the output above
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Accountant Login Credentials:
echo   Username: accountant
echo   Password: accountant123
echo.
echo To start the server, run: python app.py
echo Then navigate to: http://localhost:8000/login
echo.
pause
