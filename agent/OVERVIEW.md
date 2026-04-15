# XDM Project Overview & Repository Structure

This document provides a high-level overview of the Xtreme Download Manager (XDM) project, its repository structure, and its baseline state before modernization efforts began.

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
| `HttpClientFactory.cs` | `Environment.Version.Major == 2` check is dead code (never true) | Minor |
| `XDM.Gtk.UI.csproj` | Hardcoded DLL HintPaths | ❌ Critical |
| `NetFxHttpClient.cs` | Uses `ServicePoint` (deprecated) | Minor |
| `XDM.Tests/JsonParsingTest.cs` | Dev machine paths | ⚠️ Medium |
| `XDM.Wpf.UI.csproj` | `LangVersion 9.0` | Minor |
