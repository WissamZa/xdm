# XDM (Xtreme Download Manager) — Modernization Plan

> **Purpose:** This document tracks every planned, in-progress, and completed change to the XDM codebase.
> It exists so that any agent or engineer can open it first and immediately understand what has been done,
> what is pending, and what decisions were made along the way.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Current State Analysis (Baseline)](#3-current-state-analysis-baseline)
4. [Improvement Plan](#4-improvement-plan)
5. [Change Log](#5-change-log)
6. [Known Issues & Technical Debt](#6-known-issues--technical-debt)
7. [Build & Run Instructions](#7-build--run-instructions)

---

## 1. Project Overview

**Xtreme Download Manager (XDM)** is a cross-platform download accelerator written in C#/.NET.

| Property | Value |
|---|---|
| Language | C# |
| Platforms | Windows (WPF), Linux (GTK) |
| App Version | 8.0.25 BETA |
| License | GPL-2.0 |
| Original Author | Subhra Das Gupta |

### Core Features
- Multi-segment parallel downloading (up to 5-6× speed increase)
- Streaming video capture (via yt-dlp integration)
- Browser integration (Chrome, Firefox, Edge, Opera, Vivaldi, Brave)
- HLS / MPEG-DASH / Adobe HDS adaptive stream download
- Built-in FFmpeg-based media converter (MP3/MP4)
- Download scheduler, speed limiter, queues
- HTTP/HTTPS/FTP + proxy, auth, cookie support
- Resume broken downloads

---

## 2. Repository Structure

```
xdm/
├── .github/
│   └── workflows/
│       └── xdm-wpf-build.yml        # CI/CD — Windows WPF build only
├── app/
│   └── XDM/
│       ├── XDM_CoreFx.sln           # Main solution file
│       ├── XDM.Core/                # Shared business logic (shproj)
│       │   ├── ApplicationCore.cs   # Download orchestration
│       │   ├── AppInfo.cs           # Version & copyright strings
│       │   ├── Config.cs            # User configuration (singleton)
│       │   ├── Links.cs             # External URLs
│       │   ├── BrowserMonitoring/   # Browser extension IPC
│       │   ├── Clients/Http/        # HTTP client abstraction layer
│       │   │   ├── DotNetHttpClient.cs   # Modern HttpClient (.NET 5+)
│       │   │   ├── NetFxHttpClient.cs    # Legacy WebRequest (.NET FX)
│       │   │   └── WinHttpClient.cs     # Win32 WinHTTP (legacy .NET 2)
│       │   ├── Downloader/          # Download engine
│       │   │   ├── Progressive/     # Single/dual HTTP segmented
│       │   │   └── Adaptive/        # HLS / DASH stream
│       │   ├── Updater/             # App + yt-dlp update checker
│       │   └── YDLWrapper/          # yt-dlp process wrapper
│       ├── XDM.Messaging/           # IPC message types (shproj)
│       ├── XDM.Compatibility/       # Polyfills for older .NET (shproj)
│       ├── XDM.Wpf.UI/              # Windows WPF frontend
│       ├── XDM.Gtk.UI/              # Linux GTK frontend
│       ├── XDM.App.Host/            # Native messaging host executable
│       ├── test/                    # ALL test projects (unit + system + mock server)
│       │   ├── XDM.Tests/           # NUnit unit tests (fast, no I/O)
│       │   ├── XDM_Tests/           # NUnit system/integration tests (XDM.SystemTests)
│       │   └── MockServer/          # In-process HTTP mock server used by system tests
│       ├── NativeMessaging/         # Browser native messaging (shproj)
│       ├── XDM.WinForms.IntegrationUI/ # WinForms tray/integration
│       └── chrome-extension/        # Bundled Chrome extension
├── docs/                            # GitHub Pages website
└── translation-generator/           # Tool to generate translation files
```

---

## 3. Current State Analysis (Baseline)

### 3.1 Target Frameworks (Before Changes)

| Project | Framework | Status |
|---|---|---|
| `XDM.Wpf.UI` | `net4.7.2` | ⚠️ Old .NET Framework — no longer actively improved |
| `XDM.Gtk.UI` | `net6.0` | ❌ EOL (November 2024) |
| `XDM.Tests` | `net6.0` | ❌ EOL (November 2024) |
| `XDM_Tests` (SystemTests) | `net5.0` | ❌ EOL (May 2022) |
| `MockServer` | `net5.0` | ❌ EOL (May 2022) |
| `XDM.App.Host` | `net4.7.2` | ⚠️ Old .NET Framework |

### 3.5 Test Project Layout (Before Changes)

All three test-related directories lived at the solution root alongside production projects — no separation between test and non-test code:

```
XDM/
├── XDM.Tests/         ← unit tests mixed with app projects
├── XDM_Tests/         ← system tests mixed with app projects
├── MockServer/        ← test helper mixed with app projects
├── XDM.Core/
├── XDM.Wpf.UI/
...
```

### 3.2 NuGet Package Audit (Before Changes)

| Package | Project(s) | Current | Latest Stable | Status |
|---|---|---|---|---|
| `Newtonsoft.Json` | WPF, GTK, Host | 13.0.1 | 13.0.4 | ⚠️ Outdated |
| `System.Data.SQLite.Core` | WPF, GTK | 1.0.116 | 1.0.119 | ⚠️ Outdated |
| `GtkSharp` | GTK | 3.24.24.38 | 3.24.24.95 | ⚠️ Outdated |
| `Microsoft.Windows.Compatibility` | GTK | 5.0.2 | 9.0.0 | ❌ Very outdated |
| `Microsoft.NET.Test.Sdk` | XDM.Tests, SystemTests | 16.9.4 / 16.5.0 | 18.4.0 | ❌ Very outdated |
| `NUnit` | XDM.Tests, SystemTests | 3.13.1 / 3.12.0 | 4.5.1 | ⚠️ Outdated |
| `NUnit3TestAdapter` | XDM.Tests, SystemTests | 3.17.0 / 3.16.1 | 6.2.0 | ❌ Very outdated |
| `coverlet.collector` | XDM.Tests | 3.0.2 | 8.0.1 | ❌ Very outdated |
| `Moq` | SystemTests | 4.15.2 | 4.20.72 | ⚠️ Outdated |
| `Serilog` | SystemTests, MockServer | 2.10.0 | 4.3.1 | ❌ Very outdated |
| `Serilog.Sinks.Console` | SystemTests, MockServer | 3.1.1 | 6.1.1 | ❌ Very outdated |
| `Serilog.Sinks.File` | SystemTests, MockServer | 4.1.0 | 7.0.0 | ❌ Very outdated |
| `System.Buffers` | WPF, GTK | 4.5.1 | Built-in on .NET 8 | ✅ Remove |
| `System.ValueTuple` | WPF, GTK, MockServer | 4.5.0 | Built-in on .NET 8 | ✅ Remove |
| `System.IO.Compression` | WPF, GTK | 4.3.0 | Built-in on .NET 8 | ✅ Remove |
| `DotNetZip` | WPF | 1.12.0 | (net3.5 only guard) | ✅ Remove |

### 3.3 CI/CD Audit (Before Changes)

| Component | Current | Latest | Status |
|---|---|---|---|
| `actions/checkout` | v3 | v4 | ⚠️ Outdated |
| `actions/setup-dotnet` | v2 | v4 | ❌ Very outdated |
| `dotnet-version` | 6.0.x | 8.0.x | ❌ EOL version |
| Linux/GTK build | Missing | — | ❌ No CI for Linux |

### 3.4 Code Quality Issues (Before Changes)

| File | Issue | Severity |
|---|---|---|
| `AppInfo.cs` | Copyright year says `2023` | Minor |
| `UpdateChecker.cs` | User-Agent is Chrome 92 (2021) | ⚠️ Medium — may get blocked |
| `HttpClientFactory.cs` | `Environment.Version.Major == 2` check is dead code (never true on .NET FX 4.x or .NET 8) | Minor |
| `XDM.Gtk.UI.csproj` | Hardcoded DLL HintPaths pointing to `D:\gtksharp\...` (developer's local machine) | ❌ Critical — breaks all non-developer builds |
| `NetFxHttpClient.cs` | Uses `ServicePoint` (deprecated in .NET 8) | Minor warning |
| `XDM.Tests/JsonParsingTest.cs` | Reads from `C:\Users\subhro\Desktop\message.json` — not runnable in CI | ⚠️ Medium |
| `XDM.Wpf.UI.csproj` | `LangVersion 9.0` — could use `latest` (C# 13 on .NET 8) | Minor |
| `XDM.App.Host.csproj` | `LangVersion 9.0` — could use `latest` | Minor |

---

## 4. Improvement Plan

### Phase 1 — Framework & Runtime Upgrades ✅ Done

Upgrade all projects from EOL / outdated runtimes to .NET 8 LTS.

| Task | File | Change | Status |
|---|---|---|---|
| Upgrade WPF UI to .NET 8 | `XDM.Wpf.UI.csproj` | `net4.7.2` → `net8.0-windows` | ✅ |
| Upgrade GTK UI to .NET 8 | `XDM.Gtk.UI.csproj` | `net6.0` → `net8.0` | ✅ |
| Upgrade Tests to .NET 8 | `XDM.Tests.csproj` | `net6.0` → `net8.0` | ✅ |
| Upgrade App Host to .NET 8 | `XDM.App.Host.csproj` | `net4.7.2` → `net8.0-windows` | ✅ |
| Update C# language version (WPF) | `XDM.Wpf.UI.csproj` | `9.0` → `latest` | ✅ |
| Update C# language version (Host) | `XDM.App.Host.csproj` | `9.0` → `latest` | ✅ |

**Key notes for WPF net4.7.2 → net8.0-windows migration:**
- `UseWPF=true` and `UseWindowsForms=true` are fully supported on `net8.0-windows`
- The `-windows` suffix is mandatory for WPF/WinForms projects on modern .NET
- On .NET 8, the `#if NET5_0_OR_GREATER` guards activate → `DotNetHttpClient` (modern `HttpClient`) replaces `NetFxHttpClient` (`WebRequest`) automatically
- `PresentationFramework.Aero2` is a Windows-bundled assembly, still available
- `System.Data.SQLite.Core` targets `netstandard2.0` which .NET 8 fully implements

### Phase 2 — NuGet Package Updates ✅ Done

| Task | File | Change | Status |
|---|---|---|---|
| Update Newtonsoft.Json (WPF) | `XDM.Wpf.UI.csproj` | `13.0.1` → `13.0.4` | ✅ |
| Update Newtonsoft.Json (GTK) | `XDM.Gtk.UI.csproj` | `13.0.1` → `13.0.4` | ✅ |
| Update Newtonsoft.Json (Host) | `XDM.App.Host.csproj` | `13.0.1` → `13.0.4` | ✅ |
| Update SQLite (WPF) | `XDM.Wpf.UI.csproj` | `1.0.116` → `1.0.119` | ✅ |
| Update SQLite (GTK) | `XDM.Gtk.UI.csproj` | `1.0.116` → `1.0.119` | ✅ |
| Update GtkSharp | `XDM.Gtk.UI.csproj` | `3.24.24.38` → `3.24.24.95` | ✅ |
| Update Windows.Compatibility (GTK) | `XDM.Gtk.UI.csproj` | `5.0.2` → `9.0.0` | ✅ |
| Update Microsoft.NET.Test.Sdk | `XDM.Tests.csproj` | `16.9.4` → `18.4.0` | ✅ |
| Update NUnit | `XDM.Tests.csproj` | `3.13.1` → `4.5.1` | ✅ |
| Update NUnit3TestAdapter | `XDM.Tests.csproj` | `3.17.0` → `6.2.0` | ✅ |
| Update coverlet.collector | `XDM.Tests.csproj` | `3.0.2` → `8.0.1` | ✅ |
| Remove System.Buffers (built-in .NET 8) | WPF + GTK | Remove polyfill | ✅ |
| Remove System.ValueTuple (built-in .NET 8) | WPF + GTK | Remove polyfill | ✅ |
| Remove System.IO.Compression (built-in .NET 8) | WPF + GTK | Remove polyfill | ✅ |
| Remove DotNetZip (net3.5 guard, unused) | WPF | Remove dead package | ✅ |

### Phase 3 — Build Fixes ✅ Done

| Task | File | Change | Status |
|---|---|---|---|
| Remove hardcoded GTK DLL HintPaths | `XDM.Gtk.UI.csproj` | Remove `D:\gtksharp\...` references | ✅ |

The GTK project had manual assembly references pointing to a developer's local build output
(`D:\gtksharp\GtkSharp-master\BuildOutput\Release\*.dll`). These conflicted with the NuGet package
and prevented any non-developer build from succeeding. They have been removed; the NuGet package
alone is sufficient.

### Phase 4 — Code Modernization ✅ Done

| Task | File | Change | Status |
|---|---|---|---|
| Update copyright year | `AppInfo.cs` | `2023` → `2025` | ✅ |
| Update User-Agent string | `UpdateChecker.cs` | Chrome 92 → Chrome 131 | ✅ |
| Remove dead .NET 2 legacy path | `HttpClientFactory.cs` | Remove `Version.Major == 2` branch | ✅ |

### Phase 6 — Test Project Reorganization ✅ Done

Moved all test-related directories out of the solution root into a dedicated `test/` subdirectory.

**Before:**
```
XDM/XDM.Tests/          (unit tests at solution root)
XDM/XDM_Tests/          (system tests at solution root)
XDM/MockServer/         (test helper at solution root)
```

**After:**
```
XDM/test/XDM.Tests/     (unit tests)
XDM/test/XDM_Tests/     (system tests)
XDM/test/MockServer/    (test helper)
```

| Task | File | Change | Status |
|---|---|---|---|
| Move `XDM.Tests/` to `test/` | Directory | `XDM.Tests/` → `test/XDM.Tests/` | ✅ |
| Move `XDM_Tests/` to `test/` | Directory | `XDM_Tests/` → `test/XDM_Tests/` | ✅ |
| Move `MockServer/` to `test/` | Directory | `MockServer/` → `test/MockServer/` | ✅ |
| Update solution paths | `XDM_CoreFx.sln` | All 3 project entries updated | ✅ |
| Upgrade SystemTests to .NET 8 | `test/XDM_Tests/XDM.SystemTests.csproj` | `net5.0` → `net8.0`, all packages updated | ✅ |
| Upgrade MockServer to .NET 8 | `test/MockServer/MockServer.csproj` | `net5.0` → `net8.0`, removed unused Serilog | ✅ |
| Update NUnit (SystemTests) | `test/XDM_Tests/XDM.SystemTests.csproj` | `3.12.0` → `4.5.1` | ✅ |
| Update NUnit3TestAdapter (SystemTests) | `test/XDM_Tests/XDM.SystemTests.csproj` | `3.16.1` → `6.2.0` | ✅ |
| Update Microsoft.NET.Test.Sdk (SystemTests) | `test/XDM_Tests/XDM.SystemTests.csproj` | `16.5.0` → `18.4.0` | ✅ |
| Update Moq | `test/XDM_Tests/XDM.SystemTests.csproj` | `4.15.2` → `4.20.72` | ✅ |
| Update Serilog (SystemTests) | `test/XDM_Tests/XDM.SystemTests.csproj` | `2.10.0` → `4.3.1` | ✅ |
| Update Serilog.Sinks.Console (SystemTests) | `test/XDM_Tests/XDM.SystemTests.csproj` | `3.1.1` → `6.1.1` | ✅ |
| Update Serilog.Sinks.File (SystemTests) | `test/XDM_Tests/XDM.SystemTests.csproj` | `4.1.0` → `7.0.0` | ✅ |
| Remove unused Serilog from MockServer | `test/MockServer/MockServer.csproj` | Serilog was listed but never used in source | ✅ |
| Remove System.ValueTuple (MockServer) | `test/MockServer/MockServer.csproj` | Built into .NET 8 | ✅ |
| Add coverlet.collector (SystemTests) | `test/XDM_Tests/XDM.SystemTests.csproj` | `8.0.1` — enables coverage in CI | ✅ |

**Note on `MockServer` relative path:** The `ProjectReference` inside `XDM.SystemTests.csproj` uses `../MockServer/MockServer.csproj`. Because both projects are siblings under `test/`, this relative path is unchanged after the move.

### Phase 5 — CI/CD Updates ✅ Done

| Task | File | Change | Status |
|---|---|---|---|
| Update checkout action | `xdm-wpf-build.yml` | `v3` → `v4` | ✅ |
| Update setup-dotnet action | `xdm-wpf-build.yml` | `v2` → `v4` | ✅ |
| Update dotnet SDK version | `xdm-wpf-build.yml` | `6.0.x` → `8.0.x` | ✅ |
| Rename workflow | `xdm-wpf-build.yml` | Label as `.NET 8` | ✅ |

### Phase 7 — Build Scripts ✅ Done

Created one-click build scripts for all three platforms, placed at the repository root (`xdm/`).

| File | Platform | Shell | Status |
|---|---|---|---|
| `build.sh` | Linux + macOS | bash | ✅ |
| `build.bat` | Windows | CMD (double-click) | ✅ |
| `build.ps1` | Windows + Linux + macOS | PowerShell 5.1 / 7+ | ✅ |

**What each script does:**
1. Checks prerequisites (.NET 8 SDK, GTK3 on Linux/macOS, `binary-deps` on Windows)
2. Auto-detects platform and CPU architecture → selects the correct .NET RID
3. Publishes the platform-native UI project (`XDM.Gtk.UI` on Linux/macOS, `XDM.Wpf.UI` on Windows)
4. Publishes the browser-integration host (`XDM.App.Host`) into a `browser-host/` subfolder
5. Sets executable bit on Unix binaries
6. Prints a coloured summary with output path and file count

**Supported RIDs auto-detected:**

| Platform | RIDs covered |
|---|---|
| Linux x64 | `linux-x64` |
| Linux arm64 | `linux-arm64` |
| Linux armv7 | `linux-arm` |
| macOS x64 (Intel) | `osx-x64` |
| macOS arm64 (Apple Silicon) | `osx-arm64` |
| Windows x86/x64 | `win-x86` (WPF project pinned to x86) |

**Options available in all scripts:**

| Option | bash | batch | PowerShell | Effect |
|---|---|---|---|---|
| Build config | `-c Debug` | `/config Debug` | `-Config Debug` | Debug vs Release |
| Output dir | `-o /path` | `/output C:\path` | `-Output C:\path` | Custom output folder |
| Self-contained | `-s` | `/self-contained` | `-SelfContained` | Bundle .NET runtime |
| Help | `-h` | `/help` | `-Help` | Show usage |

**Output structure:**
```
dist/
├── linux/                  # Linux build
│   ├── xdm-app             # Main executable
│   ├── *.dll               # GTK# + core DLLs
│   ├── SQLite.Interop.so   # Native SQLite
│   ├── Lang/               # Translations
│   ├── glade/              # GTK UI definitions
│   ├── chrome-extension/   # Bundled extension
│   └── browser-host/       # xdm-app-host (native messaging)
├── macos/                  # macOS build (same structure)
└── windows/                # Windows build
    ├── xdm-app.exe         # Main WPF executable
    ├── *.dll               # Core + SQLite DLLs
    ├── Lang/               # Translations
    ├── chrome-extension/   # Bundled extension
    └── browser-host/       # xdm-app-host.exe
```

**Build verified on:** Linux x64 (CachyOS, .NET 8.0.125, GTK 3.24.52) — 62 files produced.

**Fix applied during build attempt:** `XDM.Gtk.UI.csproj` had `<PublishTrimmed>true</PublishTrimmed>` and `<TrimMode>Link</TrimMode>` unconditionally, which caused `NETSDK1102` when publishing framework-dependent. Both are now conditional on `'$(SelfContained)' == 'true'`.

### Phase 9 — Linux Desktop Integration & Wayland Support ✅ Done

| Task | File | Change | Status |
|---|---|---|---|
| Fix desktop file icon path | `app/packaging/deb/usr/share/applications/xdm-app.desktop` | Changed from hardcoded `/opt/xdman/xdm-logo.svg` to standard `Icon=xdm-app` | ✅ |
| Add SVG icon to packaging | `app/packaging/deb/usr/share/icons/hicolor/scalable/apps/xdm-app.svg` | Copied from `app/XDM/xdm-logo.svg` | ✅ |
| Add PNG icon fallback | `app/packaging/deb/usr/share/icons/hicolor/512x512/apps/xdm-app.png` | Copied from `app/XDM/xdm-logo.png` | ✅ |
| Add AppStream metadata | `app/packaging/deb/usr/share/metainfo/xdm-app.metainfo.xml` | Created comprehensive AppStream metadata for Linux software centers | ✅ |
| Enhanced Wayland support | `app/XDM/XDM.Gtk.UI/Program.cs` | Added auto-detection for Wayland with fallback to X11, enabled GTK portal support | ✅ |
| Improved icon loading | `app/XDM/XDM.Gtk.UI/MainWindow.cs` | Multi-resolution icon loading with better error handling (16px to 512px) | ✅ |
| Build script icon copy | `build.sh` | Added automatic icon copying to build output for Linux builds | ✅ |

### Phase 10 — Future Improvements (Pending)

These items are noted but have not been implemented yet. They represent larger or riskier changes.

| Task | Priority | Notes |
|---|---|---|
| Fix `test/XDM.Tests/JsonParsingTest.cs` | Medium | Test reads from `C:\Users\subhro\Desktop\message.json` — hardcoded dev path. Replace with embedded resource or inline JSON string. |
| Add CI test step | Medium | Now that tests are in `test/`, add a `dotnet test` step to the CI workflow targeting `test/XDM.Tests/`. |
| Add macOS `.app` bundle packaging | Low | Wrap the macOS build output into a proper `.app` bundle with `Info.plist` and icon so it integrates with Finder/Launchpad. |
| Add Windows installer script to build pipeline | Low | `build.bat`/`build.ps1` currently only publish binaries. Hook in WiX (`make-msi.bat`) post-publish to produce a `.msi` installer in one step. |
| Add `--version` flag to build scripts | Low | Print XDM version from `AppInfo.cs` in the build script summary. |
| Rewrite `test/XDM_Tests/` system tests | High | All test files reference `XDM.Core.Lib.*` namespaces (e.g. `XDM.Core.Lib.Common`, `XDM.Core.Lib.Downloader.*`) from an old version of XDM. The current codebase uses `XDM.Core.*`. Tests will not compile until namespaces and project references are updated. |
| Add `#pragma warning disable` for `ServicePoint` in `NetFxHttpClient.cs` | Low | `ServicePoint` is obsolete in .NET 8; it still compiles but generates warnings. Consider removing `NetFxHttpClient` entirely since it is never used on .NET 8+. |
| Migrate `XDM.Wpf.UI` to `AnyCPU` | Low | Currently locked to `x86`. Relaxing to `AnyCPU` with `Prefer32Bit=false` would allow native 64-bit execution on Windows. Requires verifying SQLite interop for x64. |
| Replace `Newtonsoft.Json` with `System.Text.Json` | Low | `System.Text.Json` is built into .NET 8 and is faster. Large refactor — not urgent. |
| Replace `System.Data.SQLite` with `Microsoft.Data.Sqlite` | Low | `Microsoft.Data.Sqlite` is the modern, officially supported SQLite library for .NET. Requires schema/API migration. |
| Update `WinHttpClient` TLS protocol flags | Low | Currently hard-codes TLS 1.0/1.1/1.2 flags. TLS 1.0/1.1 are deprecated. Should be TLS 1.2/1.3 only. |
| Add `global.json` to pin SDK | Low | Pinning the .NET SDK version prevents unexpected behaviour when multiple SDKs are installed. |
| macOS support in `UpdateChecker` | Low | `GetAppInstallerNameForCurrentOS()` has a TODO comment for macOS. |
| Add `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` | Low | Enforce zero-warning policy for new code. |
| Add Dependabot for NuGet packages | Low | Automate future package updates via `.github/dependabot.yml`. |

---

## 5. Change Log


All changes are listed in reverse-chronological order.

---

### 2025 — Linux Desktop Integration & Wayland Support

#### Phase 9: Desktop Integration — `app/packaging/deb/`
- Fixed desktop file: removed hardcoded paths, set proper `Icon=xdm-app`
- Added SVG icon: `usr/share/icons/hicolor/scalable/apps/xdm-app.svg`
- Added PNG icon: `usr/share/icons/hicolor/512x512/apps/xdm-app.png`
- Created AppStream metadata: `usr/share/metainfo/xdm-app.metainfo.xml` for software center integration

#### Phase 9: Wayland Support — `app/XDM/XDM.Gtk.UI/Program.cs`
- Enhanced Wayland auto-detection: now defaults to `wayland,x11` backend preference
- Added `GDK_ENABLE_BROADWAY=0` to disable unnecessary features
- GTK portal enabled for file dialogs on Wayland compositors

#### Phase 9: Icon Loading — `app/XDM/XDM.Gtk.UI/MainWindow.cs`
- Improved multi-resolution icon loading (16px to 512px)
- Added better error handling for missing icons
- Icons now scale properly on HiDPI displays

#### Phase 9: Build Script — `build.sh`
- Added automatic icon copying for Linux builds
- Icon now included in build output directory

---

### 2025 — Build Scripts

#### Phase 7: Build — `xdm/build.sh`, `xdm/build.bat`, `xdm/build.ps1`
- Created `build.sh` (bash, Linux + macOS) with platform + arch auto-detection, prerequisite checks, colour output, `-c/-o/-s/-h` flags
- Created `build.bat` (Windows CMD, double-click) with `/config`, `/output`, `/self-contained`, `/help` flags
- Created `build.ps1` (PowerShell 5.1+/7+, cross-platform) with `-Config`, `-Output`, `-SelfContained`, `-Help` params; also works on Linux/macOS with PowerShell Core
- All scripts publish `XDM.Gtk.UI` (Linux/macOS) or `XDM.Wpf.UI` (Windows) + `XDM.App.Host` browser host
- Build verified on Linux x64 — 62 output files, exit 0

#### Phase 7: Fix — `xdm/app/XDM/XDM.Gtk.UI/XDM.Gtk.UI.csproj`
- `PublishTrimmed` and `TrimMode` made conditional on `'$(SelfContained)' == 'true'` to fix `NETSDK1102` error when publishing framework-dependent

---

### 2025 — Test Project Reorganization

#### Phase 6: Reorganization — `xdm/app/XDM/` (solution root)
- Created `test/` subdirectory at solution level
- Moved `XDM.Tests/` → `test/XDM.Tests/`
- Moved `XDM_Tests/` → `test/XDM_Tests/`
- Moved `MockServer/` → `test/MockServer/`
- Updated `XDM_CoreFx.sln` project paths for all three entries
- `test/XDM_Tests/XDM.SystemTests.csproj`: `net5.0` → `net8.0`, `LangVersion` `9.0` → `latest`; NUnit `3.12.0` → `4.5.1`; NUnit3TestAdapter `3.16.1` → `6.2.0`; Microsoft.NET.Test.Sdk `16.5.0` → `18.4.0`; Moq `4.15.2` → `4.20.72`; Serilog `2.10.0` → `4.3.1`; Serilog.Sinks.Console `3.1.1` → `6.1.1`; Serilog.Sinks.File `4.1.0` → `7.0.0`; added `coverlet.collector 8.0.1`
- `test/MockServer/MockServer.csproj`: `net5.0` → `net8.0`, `LangVersion` `9.0` → `latest`; removed all Serilog packages (imported but never used in source); removed `System.ValueTuple` (built into .NET 8); simplified Release condition

### 2025 — Initial Modernization Pass

#### Phase 5: CI/CD — `xdm/.github/workflows/xdm-wpf-build.yml`
- `actions/checkout@v3` → `actions/checkout@v4`
- `actions/setup-dotnet@v2` → `actions/setup-dotnet@v4`
- `dotnet-version: 6.0.x` → `dotnet-version: 8.0.x`
- Renamed workflow label from `Java CI` to `.NET 8`

#### Phase 4: Code — `xdm/app/XDM/XDM.Core/AppInfo.cs`
- Copyright year updated: `2013 - 2023` → `2013 - 2025`

#### Phase 4: Code — `xdm/app/XDM/XDM.Core/Updater/UpdateChecker.cs`
- User-Agent updated from Chrome 92.0.4515.159 (released 2021) to Chrome 131.0.0.0 (2024)

#### Phase 4: Code — `xdm/app/XDM/XDM.Core/Clients/Http/HttpClientFactory.cs`
- Removed dead code path: `if (Environment.Version.Major == 2)` that returned `WinHttpClient`
  - This condition was **never true** on .NET Framework 4.x (Version.Major = 4) or .NET 5+ (Major ≥ 5)
  - It was a legacy remnant from .NET 2.0 era
- On .NET 8, `#if NET5_0_OR_GREATER` activates → `DotNetHttpClient` is always used (modern `HttpClient`)
- On older .NET Framework (if ever retargeted), `NetFxHttpClient` is used (`WebRequest` based)

#### Phase 1-3: Projects — `XDM.Wpf.UI.csproj`
- Target framework: `net4.7.2` → `net8.0-windows`
- C# language version: `9.0` → `latest`
- `Newtonsoft.Json`: `13.0.1` → `13.0.4`
- `System.Data.SQLite.Core`: `1.0.116` → `1.0.119`
- Removed `System.Buffers` (polyfill, built into .NET 8)
- Removed `System.ValueTuple` (polyfill, built into .NET 8)
- Removed `System.IO.Compression` (built into .NET 8)
- Removed `DotNetZip` (was only conditionally included for `net3.5`)

#### Phase 1-3: Projects — `XDM.Gtk.UI.csproj`
- Target framework: `net6.0` → `net8.0`
- `GtkSharp`: `3.24.24.38` → `3.24.24.95`
- `Newtonsoft.Json`: `13.0.1` → `13.0.4`
- `System.Data.SQLite.Core`: `1.0.116` → `1.0.119`
- `Microsoft.Windows.Compatibility`: `5.0.2` → `9.0.0`
- Removed hardcoded DLL HintPaths to `D:\gtksharp\GtkSharp-master\BuildOutput\Release\*.dll`
  - These 8 assembly references (`AtkSharp`, `CairoSharp`, `GdkSharp`, `GioSharp`, `GLibSharp`, `GtkSharp`, `GtkSourceSharp`, `PangoSharp`) were pointing to one developer's local machine
  - They are provided by the `GtkSharp` NuGet package and no longer need to be referenced manually
- Removed `System.Buffers` (built into .NET 8)
- Removed `System.ValueTuple` (built into .NET 8)
- Removed `System.IO.Compression` (built into .NET 8)
- Removed `DotNetZip` condition block (net3.5 only)

#### Phase 1: Projects — `XDM.Tests.csproj`
- Target framework: `net6.0` → `net8.0`
- `Microsoft.NET.Test.Sdk`: `16.9.4` → `18.4.0`
- `NUnit`: `3.13.1` → `4.5.1`
- `NUnit3TestAdapter`: `3.17.0` → `6.2.0`
- `coverlet.collector`: `3.0.2` → `8.0.1`

#### Phase 1: Projects — `XDM.App.Host.csproj`
- Target framework: `net4.7.2` → `net8.0-windows`
- C# language version: `9.0` → `latest`
- `Newtonsoft.Json`: `13.0.1` → `13.0.4`

---

## 6. Known Issues & Technical Debt

| # | File | Issue | Impact | Fix Effort |
|---|---|---|---|---|
| 1 | `test/XDM.Tests/JsonParsingTest.cs` | Test reads `C:\Users\subhro\Desktop\message.json` — will always fail in CI | High | Low |
| 2 | `test/XDM_Tests/*.cs` | All system test files reference `XDM.Core.Lib.*` namespaces from an old API version; tests will not compile until updated to `XDM.Core.*` | High | Medium |
| 3 | `NetFxHttpClient.cs` | Uses deprecated `ServicePoint` API (generates build warnings on .NET 8) | Low | Low (pragma or delete) |
| 4 | `XDM.Win.Installer/` | `binary-deps/` folder referenced in WPF csproj is not in repo (native SQLite interop DLLs) | Medium | Must supply manually for release builds |
| 5 | `WinHttpClient.cs` | TLS 1.0/1.1 still in allowed protocols list — these are insecure | Medium | Low |
| 6 | `XDM.Gtk.UI.csproj` | `<PublishTrimmed>true</PublishTrimmed>` with `<TrimMode>Link</TrimMode>` may cause runtime trim failures with reflection-heavy code (Gtk bindings, SQLite) | Medium | Test required |
| 7 | Various | `#if !NET5_0_OR_GREATER` compatibility shims in `XDM.Compatibility` — can be removed once all projects are on .NET 8 | Low | Medium |
| 8 | `XDM.Core/Interop.WinHttp/` | WinHttp P/Invoke layer used only by `WinHttpClient` which is dead code | Low | Delete files |
| 9 | `app/packaging/deb/` | Icon theme paths may need updating for different Linux distributions | Low | Low |

---

## 7. Build & Run Instructions

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8) (8.0.x or later)
- **Windows** (for WPF build): Visual Studio 2022 or `dotnet build`
- **Linux** (for GTK build): GTK 3.x runtime libraries (`libgtk-3-dev` on Debian/Ubuntu)
- **Linux** (for Wayland support): Wayland compositor (Weston, GNOME on Wayland, KDE Plasma with Wayland, etc.)
- **FFmpeg** (optional, for media conversion): place `ffmpeg` binary in app directory
- **yt-dlp** (optional, for video download): place `yt-dlp` binary in app directory

### Build — Windows (WPF)

```sh
cd app/XDM/XDM.Wpf.UI
dotnet restore
dotnet build -c Release
```

Output: `bin/Release/net8.0-windows/xdm-app.exe`

### Build — Linux (GTK)

```sh
cd app/XDM/XDM.Gtk.UI
dotnet restore
dotnet build -c Release
```

Output: `bin/Release/net8.0/xdm-app`

### Build — App Host (native messaging)

```sh
cd app/XDM/XDM.App.Host
dotnet restore
dotnet build -c Release
```

### One-Click Build

**Linux / macOS:**
```sh
./build.sh
```

**Windows (Command Prompt / double-click):**
```bat
build.bat
```

**Windows (PowerShell) — also works on Linux/macOS with PowerShell 7:**
```powershell
.\build.ps1
```

**Options (same concept across all three scripts):**
```sh
# Debug build
./build.sh -c Debug          # or  build.bat /config Debug   or  .\build.ps1 -Config Debug

# Self-contained (bundle .NET runtime, no runtime needed to run the app)
./build.sh -s                # or  build.bat /self-contained  or  .\build.ps1 -SelfContained

# Custom output folder
./build.sh -o /tmp/xdm       # or  build.bat /output C:\out   or  .\build.ps1 -Output C:\out
```

### Run Tests (Unit)

```sh
cd app/XDM/test/XDM.Tests
dotnet test --verbosity normal
```

> ⚠️ The single existing test `DeserializeBrowserMessageJsonSuccess` reads from a hardcoded path
> (`C:\Users\subhro\Desktop\message.json`) and will fail unless that file is created manually.
> This is a known issue tracked in [Known Issues #1](#6-known-issues--technical-debt).

### Run Tests (System / Integration)

```sh
cd app/XDM/test/XDM_Tests
dotnet test --verbosity normal
```

> ⚠️ System tests currently **do not compile** — they reference `XDM.Core.Lib.*` namespaces from
> an old version of the API. They need to be ported to the current `XDM.Core.*` namespace before
> they can run. Tracked in [Known Issues #2](#6-known-issues--technical-debt).

### Build Entire Solution

```sh
cd app/XDM
dotnet build XDM_CoreFx.sln
```

### Test Project Layout

```
app/XDM/test/
├── XDM.Tests/               # Fast unit tests — no network, no I/O
│   ├── XDM.Tests.csproj     # net8.0, NUnit 4.5.1
│   └── JsonParsingTest.cs
├── XDM_Tests/               # System / integration tests
│   ├── XDM.SystemTests.csproj  # net8.0, NUnit 4.5.1, Moq 4.20.72, Serilog 4.3.1
│   ├── ConfigTest.cs
│   ├── DashSanityTest.cs
│   ├── DownloadEntrySerializationTest.cs
│   ├── GenericTests.cs
│   ├── HlsSanityTests.cs
│   ├── HttpSanityTest.cs
│   ├── JsonTest.cs
│   ├── NanoServerTests.cs
│   ├── TempTests.cs
│   └── TestUtil.cs
└── MockServer/              # In-process HTTP server for integration tests
    ├── MockServer.csproj    # net8.0, no external dependencies
    ├── MockServer.cs
    └── RequestHandler.cs
```

---

*Last updated: 2025 | Maintained as part of the XDM modernization effort.*