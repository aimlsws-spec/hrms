@echo off
echo Fixing HRMS Mobile App Build...
echo.

cd hrms_mobile_app

echo Step 1: Cleaning project...
call flutter clean

echo.
echo Step 2: Getting dependencies...
call flutter pub get

echo.
echo Step 3: Building APK...
call flutter build apk --release

echo.
echo Done! APK location:
echo build\app\outputs\flutter-apk\app-release.apk
echo.
pause
