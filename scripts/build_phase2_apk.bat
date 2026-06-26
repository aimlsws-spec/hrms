@echo off
echo ========================================
echo HRMS Phase 2 - APK Builder
echo ========================================
echo.

cd hrms_mobile_app

echo Checking for Flutter...
where flutter >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Flutter not found in PATH
    echo.
    echo Please install Flutter or use Android Studio to build APK
    echo Download: https://docs.flutter.dev/get-started/install/windows
    pause
    exit /b 1
)

echo Flutter found! Building APK...
echo.

echo Step 1: Getting dependencies...
call flutter pub get

echo.
echo Step 2: Building release APK...
call flutter build apk --release

echo.
echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo.
echo APK Location:
echo build\app\outputs\flutter-apk\app-release.apk
echo.
pause
