#!/usr/bin/env pwsh
# =============================================================================
# XDM — Xtreme Download Manager
# Build script for Windows (PowerShell 5.1+ and PowerShell Core 7+)
# Works on: Windows PowerShell 5.1, PowerShell 7+
# Also works on Linux/macOS with PowerShell Core 7 + GTK3
#
# Usage:  .\build.ps1 [options]
# =============================================================================
[CmdletBinding()]
param (
    [ValidateSet('Debug','Release')]
    [string] $Config         = 'Release',
    [string] $Output         = '',
    [switch] $SelfContained,
    [switch] $Help
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Helpers ────────────────────────────────────────────────────────────────────
function Write-Header([string]$msg) {
    Write-Host ""
    Write-Host "  $msg" -ForegroundColor Cyan -NoNewline
    Write-Host ""
    Write-Host ("  " + ("─" * 58)) -ForegroundColor DarkCyan
}
function Write-OK([string]$msg)   { Write-Host "  [  OK  ] " -ForegroundColor Green  -NoNewline; Write-Host $msg }
function Write-Info([string]$msg) { Write-Host "  [ INFO ] " -ForegroundColor Cyan   -NoNewline; Write-Host $msg }
function Write-Warn([string]$msg) { Write-Host "  [ WARN ] " -ForegroundColor Yellow -NoNewline; Write-Host $msg }
function Write-Err([string]$msg)  { Write-Host "  [ERROR ] " -ForegroundColor Red    -NoNewline; Write-Host $msg }
function Fail([string]$msg)       { Write-Err $msg; exit 1 }

# ── Help ───────────────────────────────────────────────────────────────────────
if ($Help) {
    Write-Host @"

  XDM Build Script — PowerShell
  ══════════════════════════════

  Usage:
    .\build.ps1 [options]

  Options:
    -Config  <Debug|Release>   Build configuration   (default: Release)
    -Output  <path>            Output directory       (default: dist\windows or dist\linux or dist\macos)
    -SelfContained             Bundle .NET runtime    (no runtime needed at launch)
    -Help                      Show this help

  Examples:
    .\build.ps1                              # Release build, framework-dependent
    .\build.ps1 -Config Debug               # Debug build
    .\build.ps1 -SelfContained              # Bundle .NET runtime (~100 MB larger)
    .\build.ps1 -Output C:\xdm-out          # Custom output folder

"@
    exit 0
}

# ── Platform detection ─────────────────────────────────────────────────────────
$IsWin   = $IsWindows -or ($PSVersionTable.PSEdition -eq 'Desktop')
$IsMacOs = $IsMacOS
$IsLnx   = $IsLinux

if ($IsWin) {
    $Platform      = 'Windows'
    $Arch          = if ([System.Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
    # WPF project is pinned to x86 for SQLite interop compatibility
    $MainRID       = 'win-x86'
    $HostRID       = 'win-x86'
    if (-not $Output) { $Output = Join-Path $PSScriptRoot 'dist\windows' }
} elseif ($IsMacOs) {
    $Platform      = 'macOS'
    $Arch          = if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq 'Arm64') { 'arm64' } else { 'x64' }
    $MainRID       = "osx-$Arch"
    $HostRID       = "osx-$Arch"
    if (-not $Output) { $Output = Join-Path $PSScriptRoot 'dist/macos' }
} elseif ($IsLnx) {
    $Platform      = 'Linux'
    $Arch          = if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq 'Arm64') { 'arm64' } else { 'x64' }
    $MainRID       = "linux-$Arch"
    $HostRID       = "linux-$Arch"
    if (-not $Output) { $Output = Join-Path $PSScriptRoot 'dist/linux' }
} else {
    Fail "Unknown platform. Expected Windows, macOS, or Linux."
}

$SolutionDir = Join-Path $PSScriptRoot 'app/XDM'
$WpfProj     = Join-Path $SolutionDir 'XDM.Wpf.UI/XDM.Wpf.UI.csproj'
$GtkProj     = Join-Path $SolutionDir 'XDM.Gtk.UI/XDM.Gtk.UI.csproj'
$HostProj    = Join-Path $SolutionDir 'XDM.App.Host/XDM.App.Host.csproj'
$HostOut     = Join-Path $Output 'browser-host'

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║          XDM — Xtreme Download Manager                  ║" -ForegroundColor Cyan
Write-Host "  ║          Build Script (PowerShell)                       ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ── Prerequisites ─────────────────────────────────────────────────────────────
Write-Header "Checking prerequisites"

# .NET SDK
$dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnetCmd) {
    Write-Err ".NET SDK not found."
    if ($IsWin)   { Write-Info "Download: https://dotnet.microsoft.com/download/dotnet/8.0" }
    if ($IsMacOs) { Write-Info "Install:  brew install --cask dotnet-sdk" }
    if ($IsLnx)   { Write-Info "Install:  sudo apt-get install dotnet-sdk-8.0  (or pacman / dnf)" }
    exit 1
}

$sdkVersion = (dotnet --version).Trim()
$sdkMajor   = [int]($sdkVersion.Split('.')[0])
if ($sdkMajor -lt 8) { Fail ".NET 8+ SDK required. Found: $sdkVersion" }
Write-OK ".NET SDK $sdkVersion"

# GTK3 (non-Windows only)
if (-not $IsWin) {
    $gtkOk = $false
    try {
        $null = & pkg-config --exists gtk+-3.0 2>&1
        if ($LASTEXITCODE -eq 0) {
            $gtkVer = (& pkg-config --modversion gtk+-3.0).Trim()
            Write-OK "GTK3 $gtkVer"
            $gtkOk = $true
        }
    } catch {}
    if (-not $gtkOk) {
        Write-Warn "GTK3 not found — app will fail to start without it."
        if ($IsMacOs) { Write-Info "Install: brew install gtk+3" }
        else          { Write-Info "Install: sudo apt-get install libgtk-3-dev  (or pacman -S gtk3)" }
    }
}

# binary-deps check (Windows only)
if ($IsWin) {
    $binaryDeps = Join-Path $SolutionDir 'XDM.Win.Installer\binary-deps'
    if (-not (Test-Path $binaryDeps)) {
        Write-Warn "binary-deps not found at: $binaryDeps"
        Write-Warn "The WPF project references this folder for native SQLite DLLs."
        Write-Warn "The build may succeed but the app may fail to start."
    }
}

# ── Build ─────────────────────────────────────────────────────────────────────
Write-Header "Building XDM for $Platform ($MainRID) — $Config"
Write-Info "Output      : $Output"
Write-Info "Browser host: $HostOut"
$scLabel = if ($SelfContained) { 'self-contained (bundles .NET runtime)' } else { 'framework-dependent (requires .NET runtime)' }
Write-Info "Mode        : $scLabel"

New-Item -ItemType Directory -Force -Path $Output    | Out-Null
New-Item -ItemType Directory -Force -Path $HostOut   | Out-Null

# Select the right project for this platform
$MainProj = if ($IsWin) { $WpfProj } else { $GtkProj }

# Build flags
$scFlag = if ($SelfContained) { '--self-contained', 'true' } else { '--self-contained', 'false' }
$platformFlag = if ($IsWin) { @('-p:Platform=x86') } else { @() }

# Publish main app
Write-Info "Publishing main application..."
$mainArgs = @(
    'publish', $MainProj,
    '-c', $Config,
    '-r', $MainRID
) + $scFlag + @(
    '-o', $Output,
    '-p:PublishReadyToRun=true',
    '--nologo'
) + $platformFlag

& dotnet @mainArgs
if ($LASTEXITCODE -ne 0) { Fail "Main application publish failed (exit code $LASTEXITCODE)." }
Write-OK "Main application published."

# Publish App Host
Write-Info "Publishing browser-integration host..."
$hostArgs = @(
    'publish', $HostProj,
    '-c', $Config,
    '-r', $HostRID,
    '--self-contained', 'false',
    '-o', $HostOut,
    '--nologo'
) + $platformFlag

& dotnet @hostArgs
if ($LASTEXITCODE -ne 0) { Fail "Browser host publish failed (exit code $LASTEXITCODE)." }
Write-OK "Browser host published."

# Make binaries executable on Unix
if (-not $IsWin) {
    $exeName  = Join-Path $Output 'xdm-app'
    $hostName = Join-Path $HostOut 'xdm-app-host'
    if (Test-Path $exeName)  { & chmod +x $exeName }
    if (Test-Path $hostName) { & chmod +x $hostName }
}

# ── Summary ───────────────────────────────────────────────────────────────────
$fileCount = (Get-ChildItem $Output -File).Count
Write-Header "Build complete"
Write-OK "Platform      : $Platform ($Arch)"
Write-OK "Configuration : $Config"
Write-OK "Output        : $Output"
Write-OK "Browser host  : $HostOut"
Write-OK "Files output  : $fileCount"
Write-Host ""
if ($IsWin) {
    Write-Info "To run: $Output\xdm-app.exe"
} else {
    Write-Info "To run: $Output/xdm-app"
}
Write-Host ""
