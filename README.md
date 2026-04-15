<p id="downloads" align="center">
	<img src="https://i.stack.imgur.com/TOfqL.png" height="120px"/>
	<h1 align="center">Xtreme Download Manager (XDM)</h1>
</p>

<p align="center">
	<img src="https://img.shields.io/badge/.NET-8.0-blue.svg" alt=".NET 8" />
	<img src="https://img.shields.io/badge/C%23-13.0-green.svg" alt="C# 13" />
	<img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg" alt="Platform" />
	<img src="https://img.shields.io/github/license/subhra74/xdm.svg" alt="License" />
</p>

---

**Xtreme Download Manager (XDM)** is a powerful, cross-platform download accelerator designed to increase download speeds by up to 500%. It features advanced segmenting technology, video streaming capture, and seamless browser integration.

This version of XDM represents a **major modernization effort**, moving from legacy Java to **modern .NET 8**, providing better performance, smaller binaries, and native feel on all platforms.

## ✨ Key Features

- **Blazing Fast Downloads:** Multi-segment parallel downloading for maximum speed.
- **Video Grabber:** Save streaming videos from YouTube, Vimeo, and thousands of other sites.
- **Universal Integration:** Seamlessly works with Chrome, Firefox, Edge, Opera, Vivaldi, and more.
- **Adaptive Streaming:** Full support for HLS, MPEG-DASH, and Adobe HDS formats.
- **Built-in Media Converter:** Convert downloaded videos to MP3 or MP4 automatically.
- **Native Experience:** Native WPF UI on Windows and GTK3 UI on Linux/macOS with Wayland support.
- **Smart Scheduler:** Schedule downloads, limit speeds, and manage queues effectively.

## 🖼️ Screenshots

| ![xdm_main][01] | ![xdm_video][05] | ![xdm_settings][03] |
| :---: | :---: | :---: |
| Main Interface | Video Capture | Advanced Settings |

## 🚀 Quick Start

### 1. Download Binaries
Grab the latest release for your platform from the [Releases](https://github.com/subhra74/xdm/releases) page.

- **Windows:** Download `.msi` or portable `.zip`.
- **Linux:** Download `.deb` or portable `.tar.xz`.
- **macOS:** Download `.dmg` or portable `.tar.xz`.

### 2. Install Browser Extension
To enable automatic download capturing, install the XDM Browser Monitor for your browser:
- [Chrome / Edge / Opera / Brave / Vivaldi][18]
- [Firefox][19]

## 🛠️ Building from Source

XDM is now built using the **.NET 8 SDK**.

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- **Windows:** Visual Studio 2022 (with WPF workload)
- **Linux:** GTK3 development libraries (`libgtk-3-dev`)

### One-Click Build
We provide easy build scripts in the repository root:

```bash
# Linux / macOS
./build.sh

# Windows (CMD)
build.bat

# Windows (PowerShell)
.\build.ps1
```

The output will be generated in the `dist/` directory.

## 📈 Project Status

This project is undergoing active modernization. For detailed information on completed tasks and future roadmap, please refer to our [**Modernization Plan**](PLAN.md).

- [**TASKS.md**](agent/TASKS.md) — Current progress and upcoming features.
- [**HISTORY.md**](agent/HISTORY.md) — Change log for recent versions.

## 🌍 Translations

Help us make XDM available in your language! You can submit translations through our [Translation Generator Tool](translation-generator/).

---

### Links & Resources

- [Official Website](https://xtremedownloadmanager.com/)
- [Bug Reports](https://github.com/subhra74/xdm/issues)
- [Discussions](https://github.com/subhra74/xdm/discussions)

[//]: #ImageLinks
[01]: https://i.stack.imgur.com/s7ViA.jpg
[03]: https://i.stack.imgur.com/V5XF3.jpg
[05]: https://i.stack.imgur.com/lmAr6.png

[//]: #AddonLinks
[18]: https://chrome.google.com/webstore/detail/xtreme-download-manager/dkckaoghoiffdbomfbbodbbgmhjblecj
[19]: https://addons.mozilla.org/en-US/firefox/addon/xdm-browser-monitor/
