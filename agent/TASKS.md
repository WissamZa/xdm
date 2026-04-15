# XDM Improvement Plan

This document outlines the planned, in-progress, and completed tasks for the XDM modernization effort.

---

## 4. Improvement Plan

### Phase 1 — Framework & Runtime Upgrades ✅ Done
Upgrade all projects from EOL / outdated runtimes to .NET 8 LTS.

### Phase 2 — NuGet Package Updates ✅ Done
Update dependencies to supported versions.

### Phase 3 — Build Fixes ✅ Done
Remove local machine paths and fix CI/CD build issues.

### Phase 4 — Code Modernization ✅ Done
Update copyright, user agents, and remove legacy dead code.

### Phase 5 — CI/CD Updates ✅ Done
Update GitHub Actions to use .NET 8 and latest actions.

### Phase 6 — Test Project Reorganization ✅ Done
Moved all test-related directories into a dedicated `test/` subdirectory.

### Phase 7 — Build Scripts ✅ Done
Created `build.sh`, `build.bat`, and `build.ps1` for easy cross-platform builds.

### Phase 8 — Bug Fixes & Stability (Ongoing)
Addressing known issues in the codebase.

### Phase 9 — Linux Desktop Integration & Wayland Support ✅ Done (Initial)
- Fixed desktop file icon path
- Added SVG/PNG icons to packaging
- Enhanced Wayland auto-detection in GTK frontend
- Multi-resolution icon loading

### Phase 10 — Future Improvements (Pending)
- [ ] Fix `test/XDM.Tests/JsonParsingTest.cs` (Hardcoded path)
- [ ] Add CI test step
- [ ] macOS `.app` bundle packaging
- [ ] Windows installer script improvements
- [ ] Rewrite `test/XDM_Tests/` system tests
- [ ] Replace `Newtonsoft.Json` with `System.Text.Json`
- [x] Implement KDE Plasma 6 native Wayland support ✅ Done
- [x] Fix app icon not showing in some environments ✅ Done
