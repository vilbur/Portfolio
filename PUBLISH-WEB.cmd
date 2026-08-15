@echo off
setlocal
title Portfolio - publish website
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\publish.ps1"
set "PUBLISH_EXIT=%ERRORLEVEL%"
echo.
if "%PUBLISH_EXIT%"=="0" (
  echo Finished successfully.
) else (
  echo Publication stopped because a check or upload failed.
)
echo Press any key to close this window.
pause >nul
exit /b %PUBLISH_EXIT%
