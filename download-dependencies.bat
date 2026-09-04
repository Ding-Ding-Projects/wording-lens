@echo off
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
set "SILENT_FLAG="
if /I "%~1"=="/s" set "SILENT_FLAG=-Silent"
if /I "%~1"=="--silent" set "SILENT_FLAG=-Silent"
if /I "%SILENT%"=="1" set "SILENT_FLAG=-Silent"
where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo [bootstrap] powershell.exe is required and was not found.
  exit /b 1
)
set "PSModulePath="
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\bootstrap-dependencies.ps1" %SILENT_FLAG%
exit /b %errorlevel%
