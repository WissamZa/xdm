@echo off
setlocal enabledelayedexpansion
:: =============================================================================
:: XDM — Xtreme Download Manager
:: Build script for Windows (Command Prompt)
:: Usage:  build.bat [options]
::
:: Options:
::   /config <Debug|Release>   Build configuration (default: Release)
::   /output <dir>             Output directory    (default: dist\windows)
::   /self-contained           Bundle .NET runtime
::   /help                     Show this help
:: =============================================================================

title XDM Build

:: ── Colour helpers (via ANSI if supported) ────────────────────────────────────
:: Enable virtual terminal processing on Windows 10+
for /f "tokens=4-5 delims=. " %%i in ('ver') do set WIN_VER=%%i.%%j
reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1

:: ── Defaults ─────────────────────────────────────────────────────────────────
set CONFIG=Release
set SELF_CONTAINED=false
set OUTPUT_DIR=

:: ── Parse arguments ───────────────────────────────────────────────────────────
:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="/help"           goto :show_help
if /i "%~1"=="-h"              goto :show_help
if /i "%~1"=="/config"         ( set "CONFIG=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="/output"         ( set "OUTPUT_DIR=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="/self-contained" ( set SELF_CONTAINED=true & shift & goto :parse_args )
echo [WARN] Unknown option: %~1
shift
goto :parse_args
:args_done

:: ── Paths ─────────────────────────────────────────────────────────────────────
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%
set SOLUTION_DIR=%SCRIPT_DIR%\app\XDM
set WPF_PROJ=%SOLUTION_DIR%\XDM.Wpf.UI\XDM.Wpf.UI.csproj
set HOST_PROJ=%SOLUTION_DIR%\XDM.App.Host\XDM.App.Host.csproj

if "%OUTPUT_DIR%"=="" set OUTPUT_DIR=%SCRIPT_DIR%\dist\windows
set HOST_OUT=%OUTPUT_DIR%\browser-host

goto :main

:: ── Help ──────────────────────────────────────────────────────────────────────
:show_help
echo.
echo  XDM Build Script -- Windows
echo  ============================
echo.
echo  Usage: build.bat [options]
echo.
echo  Options:
echo    /config ^<Debug^|Release^>   Build configuration   (default: Release)
echo    /output ^<dir^>             Output directory       (default: dist\windows)
echo    /self-contained           Bundle .NET runtime    (no runtime needed at launch)
echo    /help                     Show this help
echo.
echo  Examples:
echo    build.bat                        -- Release build
echo    build.bat /config Debug          -- Debug build
echo    build.bat /self-contained        -- Self-contained build
echo    build.bat /output C:\xdm-out     -- Custom output folder
echo.
exit /b 0

:: ── Main ─────────────────────────────────────────────────────────────────────
:main
echo.
echo ============================================================
echo  XDM Build Script -- Windows
echo ============================================================

:: ── Check .NET SDK ────────────────────────────────────────────────────────────
echo.
echo [....] Checking prerequisites...

where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET SDK not found in PATH.
    echo         Download from: https://dotnet.microsoft.com/download/dotnet/8.0
    exit /b 1
)

for /f "usebackq tokens=*" %%v in (`dotnet --version`) do set SDK_VER=%%v
for /f "delims=." %%a in ("!SDK_VER!") do set SDK_MAJOR=%%a
if !SDK_MAJOR! LSS 8 (
    echo [ERROR] .NET 8+ SDK required. Found: !SDK_VER!
    echo         Download from: https://dotnet.microsoft.com/download/dotnet/8.0
    exit /b 1
)
echo [ OK ]  .NET SDK !SDK_VER!

:: ── Check binary-deps ─────────────────────────────────────────────────────────
set BINARY_DEPS=%SOLUTION_DIR%\XDM.Win.Installer\binary-deps
if not exist "%BINARY_DEPS%" (
    echo [WARN]  binary-deps folder not found: %BINARY_DEPS%
    echo         The WPF project references this folder for native SQLite DLLs.
    echo         Build may succeed but the app may fail to start without them.
    echo         Expected location: app\XDM\XDM.Win.Installer\binary-deps\
)

:: ── Detect architecture ───────────────────────────────────────────────────────
set ARCH=x86
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" set ARCH=x86
if "%PROCESSOR_ARCHITEW6432%"=="AMD64" set ARCH=x86
:: WPF project targets x86 — always use win-x86 for the main app
set RID=win-x86
set HOST_RID=win-x86

echo.
echo ============================================================
echo  Building XDM for Windows (%RID%) -- %CONFIG%
echo  Output: %OUTPUT_DIR%
if "%SELF_CONTAINED%"=="true" (
    echo  Mode:   Self-contained (bundles .NET runtime)
) else (
    echo  Mode:   Framework-dependent (requires .NET runtime at launch)
)
echo ============================================================

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
if not exist "%HOST_OUT%"   mkdir "%HOST_OUT%"

:: ── Build main WPF application ───────────────────────────────────────────────
echo.
echo [....] Publishing main application (WPF)...

if "%SELF_CONTAINED%"=="true" (
    dotnet publish "%WPF_PROJ%" ^
        -c %CONFIG% ^
        -r %RID% ^
        --self-contained true ^
        -o "%OUTPUT_DIR%" ^
        -p:Platform=x86 ^
        -p:PublishReadyToRun=true ^
        --nologo
) else (
    dotnet publish "%WPF_PROJ%" ^
        -c %CONFIG% ^
        -r %RID% ^
        --self-contained false ^
        -o "%OUTPUT_DIR%" ^
        -p:Platform=x86 ^
        -p:PublishReadyToRun=true ^
        --nologo
)

if errorlevel 1 (
    echo [ERROR] Main application build failed.
    exit /b 1
)
echo [ OK ]  Main application published.

:: ── Build browser-integration host ───────────────────────────────────────────
echo.
echo [....] Publishing browser-integration host...

dotnet publish "%HOST_PROJ%" ^
    -c %CONFIG% ^
    -r %HOST_RID% ^
    --self-contained false ^
    -o "%HOST_OUT%" ^
    -p:Platform=x86 ^
    --nologo

if errorlevel 1 (
    echo [ERROR] Browser host build failed.
    exit /b 1
)
echo [ OK ]  Browser host published.

:: ── Summary ───────────────────────────────────────────────────────────────────
echo.
echo ============================================================
echo  BUILD COMPLETE
echo ============================================================
echo  Configuration : %CONFIG%
echo  Output        : %OUTPUT_DIR%
echo  Browser host  : %HOST_OUT%
echo  To run        : %OUTPUT_DIR%\xdm-app.exe
echo ============================================================
echo.
endlocal
exit /b 0
