# Build & Run Instructions

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8)
- **Windows:** Visual Studio 2022 or `dotnet build`
- **Linux:** GTK 3.x runtime (`libgtk-3-dev`)
- **FFmpeg/yt-dlp:** (Optional) Place binaries in app directory

## One-Click Build

Use the scripts at the repository root:

- **Linux / macOS:** `./build.sh`
- **Windows:** `build.bat` or `.\build.ps1`

### Options
- `-c Debug` / `/config Debug`: Debug build
- `-s` / `/self-contained`: Bundle .NET runtime
- `-o <dir>` / `/output <dir>`: Custom output folder

## Manual Build

### Windows (WPF)
```sh
cd app/XDM/XDM.Wpf.UI
dotnet build -c Release
```

### Linux (GTK)
```sh
cd app/XDM/XDM.Gtk.UI
dotnet build -c Release
```

## Running Tests

### Unit Tests
```sh
cd app/XDM/test/XDM.Tests
dotnet test
```

### System Tests
```sh
cd app/XDM/test/XDM_Tests
dotnet test # Note: Currently requires porting to new namespaces
```
