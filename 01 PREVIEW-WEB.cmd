@echo off
setlocal
title Portfolio - prepare local preview
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\publish.ps1" -CheckOnly
if errorlevel 1 (
  echo.
  echo Preview preparation failed. Press any key to close.
  pause >nul
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\preview.ps1"
if errorlevel 1 (
  echo.
  echo Preview server failed. Press any key to close.
  pause >nul
  exit /b 1
)
exit /b 0
