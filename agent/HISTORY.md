# XDM Change Log

All significant changes to the XDM project are documented here in reverse-chronological order.

---

## 2026-04-15 — KDE Plasma 6 & Icon Fixes

### Linux Integration
- **Fix:** Resolved app icon not showing by fixing a syntax error in `MainWindow.cs` and adding a fallback mechanism for different icon filenames (`xdm-logo.png` and `xdm-logo-512.png`).
- **Feat:** Implemented native KDE Plasma 6 Wayland support by explicitly setting `GLib.Global.ProgramName` and `GLib.Global.ApplicationName` in `Program.cs`. This allows KWin to correctly associate the window with its `.desktop` file and icon.
- **Build:** Updated `build.sh` to copy multiple icon formats (SVG, 512px PNG) to the output directory.
- **Cleanup:** Fixed several syntax errors and stray braces in `Program.cs` and `MainWindow.cs` that were introduced in previous modernization phases.

---

## 2025 — Linux Desktop Integration & Wayland Support (Phase 9)

- **Desktop File:** Removed hardcoded paths, set proper `Icon=xdm-app`.
- **Icons:** Added SVG and 512px PNG icons to `usr/share/icons/hicolor`.
- **AppStream:** Created `xdm-app.metainfo.xml` for software centers.
- **Wayland:** Enhanced auto-detection, set `GDK_BACKEND=wayland,x11`, enabled GTK portals.
- **UI:** Improved multi-resolution icon loading in `MainWindow.cs`.
- **Build:** `build.sh` now copies icons to the output directory.

---

## 2025 — Build Scripts & Fixes (Phase 7)

- **Shell Scripts:** Created `build.sh`, `build.bat`, and `build.ps1` with platform auto-detection.
- **Framework Fix:** Made `PublishTrimmed` conditional to fix `NETSDK1102`.

---

## 2025 — Test Project Reorganization (Phase 6)

- **Layout:** Moved `XDM.Tests`, `XDM_Tests`, and `MockServer` to `test/` subdirectory.
- **Upgrades:** Upgraded all test projects to .NET 8.
- **Logging:** Cleaned up Serilog usage in `MockServer`.

---

## 2025 — Initial Modernization Pass (Phases 1-5)

- **Framework:** Migrated WPF, GTK, and Host projects to .NET 8.
- **NuGet:** Updated all dependencies (Newtonsoft.Json, SQLite, GtkSharp, etc.).
- **CI/CD:** Updated GitHub Actions to `v4` and .NET 8 SDK.
- **Code:** Updated copyright year (2025) and User-Agent (Chrome 131).
- **Cleanup:** Removed dead .NET 2.0 legacy code paths in `HttpClientFactory`.
