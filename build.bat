@echo off
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
set "SILENT_FLAG="
set "RUN_FLAG="
if /I "%~1"=="/s" set "SILENT_FLAG=-Silent"
if /I "%~1"=="--silent" set "SILENT_FLAG=-Silent"
if /I "%SILENT%"=="1" set "SILENT_FLAG=-Silent"
if /I "%~1"=="--run" set "RUN_FLAG=-RunAfterBuild"
if /I "%~1"=="/run" set "RUN_FLAG=-RunAfterBuild"
if /I "%~2"=="--run" set "RUN_FLAG=-RunAfterBuild"
if /I "%~2"=="/run" set "RUN_FLAG=-RunAfterBuild"
if /I "%RUN_AFTER_BUILD%"=="1" set "RUN_FLAG=-RunAfterBuild"
where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo [build] powershell.exe is required and was not found.
  exit /b 1
)
rem Let Windows PowerShell construct its own module paths after a pwsh/cmd hop.
set "PSModulePath="
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\build-project.ps1" %SILENT_FLAG% %RUN_FLAG%
exit /b %errorlevel%
