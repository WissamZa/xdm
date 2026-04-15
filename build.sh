#!/usr/bin/env bash
# =============================================================================
# XDM — Xtreme Download Manager
# Build script for Linux and macOS
# Usage:  ./build.sh [options]
#
# Options:
#   -c, --config  <Debug|Release>   Build configuration (default: Release)
#   -o, --output  <dir>             Output directory (default: dist/linux or dist/macos)
#   -s, --self-contained            Bundle .NET runtime (larger, no .NET needed at runtime)
#   -h, --help                      Show this help
# =============================================================================
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}$*${RESET}"; echo -e "${CYAN}$(printf '─%.0s' {1..60})${RESET}"; }

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOLUTION_DIR="$SCRIPT_DIR/app/XDM"
GTK_PROJ="$SOLUTION_DIR/XDM.Gtk.UI/XDM.Gtk.UI.csproj"
HOST_PROJ="$SOLUTION_DIR/XDM.App.Host/XDM.App.Host.csproj"

# ── Defaults ──────────────────────────────────────────────────────────────────
CONFIG="Release"
SELF_CONTAINED="false"
OUTPUT_DIR=""

# ── Argument parsing ──────────────────────────────────────────────────────────
show_help() {
  cat <<EOF
${BOLD}XDM Build Script — Linux / macOS${RESET}

Usage: ./build.sh [options]

Options:
  -c, --config <Debug|Release>   Build configuration   (default: Release)
  -o, --output <dir>             Output directory       (default: dist/linux or dist/macos)
  -s, --self-contained           Bundle .NET runtime    (no runtime required at launch)
  -h, --help                     Show this help

Examples:
  ./build.sh                          # Release build, framework-dependent
  ./build.sh -c Debug                 # Debug build
  ./build.sh -s                       # Self-contained (bundles .NET runtime)
  ./build.sh -o /tmp/xdm-build        # Custom output folder
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--config)          CONFIG="$2";      shift 2 ;;
    -o|--output)          OUTPUT_DIR="$2";  shift 2 ;;
    -s|--self-contained)  SELF_CONTAINED="true"; shift ;;
    -h|--help)            show_help; exit 0 ;;
    *) die "Unknown option: $1. Run ./build.sh --help for usage." ;;
  esac
done

# ── Platform detection ────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)
    PLATFORM_LABEL="Linux"
    case "$ARCH" in
      x86_64)  RID="linux-x64" ;;
      aarch64) RID="linux-arm64" ;;
      armv7l)  RID="linux-arm" ;;
      *)       die "Unsupported Linux architecture: $ARCH" ;;
    esac
    [[ -z "$OUTPUT_DIR" ]] && OUTPUT_DIR="$SCRIPT_DIR/dist/linux"
    ;;
  Darwin)
    PLATFORM_LABEL="macOS"
    case "$ARCH" in
      x86_64) RID="osx-x64" ;;
      arm64)  RID="osx-arm64" ;;
      *)      die "Unsupported macOS architecture: $ARCH" ;;
    esac
    [[ -z "$OUTPUT_DIR" ]] && OUTPUT_DIR="$SCRIPT_DIR/dist/macos"
    ;;
  *)
    die "Unsupported OS: $OS. Use build.bat or build.ps1 on Windows."
    ;;
esac

HOST_OUT="$OUTPUT_DIR/browser-host"

# ── Prerequisite checks ───────────────────────────────────────────────────────
header "Checking prerequisites"

# .NET SDK
if ! command -v dotnet &>/dev/null; then
  error ".NET 8 SDK not found in PATH."
  if [[ "$OS" == "Darwin" ]]; then
    info "Install with: brew install --cask dotnet-sdk"
    info "Or download from: https://dotnet.microsoft.com/download/dotnet/8.0"
  else
    info "Arch/Manjaro:  sudo pacman -S dotnet-sdk-8.0"
    info "Debian/Ubuntu: sudo apt-get install dotnet-sdk-8.0"
    info "Fedora:        sudo dnf install dotnet-sdk-8.0"
    info "Or download from: https://dotnet.microsoft.com/download/dotnet/8.0"
  fi
  exit 1
fi

SDK_VER="$(dotnet --version)"
SDK_MAJOR="${SDK_VER%%.*}"
if (( SDK_MAJOR < 8 )); then
  die ".NET 8+ SDK required. Found: $SDK_VER — upgrade from https://dot.net/download"
fi
success ".NET SDK $SDK_VER"

# GTK3
GTK_OK=true
if command -v pkg-config &>/dev/null && pkg-config --exists gtk+-3.0 2>/dev/null; then
  GTK_VER="$(pkg-config --modversion gtk+-3.0)"
  success "GTK3 $GTK_VER"
else
  GTK_OK=false
  warn "GTK3 not found — the app will fail at runtime without it."
  if [[ "$OS" == "Darwin" ]]; then
    info "Install with: brew install gtk+3"
  else
    info "Arch/Manjaro:  sudo pacman -S gtk3"
    info "Debian/Ubuntu: sudo apt-get install libgtk-3-dev"
    info "Fedora:        sudo dnf install gtk3-devel"
  fi
fi

# ── Build ─────────────────────────────────────────────────────────────────────
header "Building XDM for $PLATFORM_LABEL ($RID) — $CONFIG"
info "Output directory: $OUTPUT_DIR"
[[ "$SELF_CONTAINED" == "true" ]] && info "Mode: self-contained (bundles .NET runtime)" \
                                  || info "Mode: framework-dependent (requires .NET runtime at launch)"

mkdir -p "$OUTPUT_DIR"

SC_FLAG="--self-contained $SELF_CONTAINED"
EXTRA_FLAGS=""
if [[ "$SELF_CONTAINED" == "true" ]]; then
  EXTRA_FLAGS="-p:PublishSingleFile=false"
fi

info "Publishing main application..."
dotnet publish "$GTK_PROJ" \
  -c "$CONFIG" \
  -r "$RID" \
  $SC_FLAG \
  -o "$OUTPUT_DIR" \
  -p:PublishReadyToRun=true \
  $EXTRA_FLAGS \
  --nologo

success "Main application published."

# ── App Host (native messaging bridge) ───────────────────────────────────────
info "Publishing browser-integration host..."
mkdir -p "$HOST_OUT"
dotnet publish "$HOST_PROJ" \
  -c "$CONFIG" \
  -r "$RID" \
  --self-contained false \
  -o "$HOST_OUT" \
  --nologo

success "Browser host published."

# ── Make the binary executable ────────────────────────────────────────────────
chmod +x "$OUTPUT_DIR/xdm-app" 2>/dev/null || true
chmod +x "$HOST_OUT/xdm-app-host" 2>/dev/null || true

# ── Copy icon for Linux builds ───────────────────────────────────────────────
if [[ "$PLATFORM_LABEL" == "Linux" ]]; then
    info "Copying application icon..."
    ICON_SRC="$SOLUTION_DIR/xdm-logo.png"
    ICON_DEST="$OUTPUT_DIR/xdm-logo.png"
    if [[ -f "$ICON_SRC" ]]; then
        cp "$ICON_SRC" "$ICON_DEST"
        success "Icon copied to output directory"
    else
        warn "Icon file not found: $ICON_SRC"
    fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
header "Build complete"
success "Platform:        $PLATFORM_LABEL ($ARCH)"
success "Configuration:   $CONFIG"
success "Output:          $OUTPUT_DIR"
success "Browser host:    $HOST_OUT"

FILE_COUNT="$(find "$OUTPUT_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')"
success "Files in output: $FILE_COUNT"

if [[ "$GTK_OK" == "false" ]]; then
  echo ""
  warn "GTK3 was not detected. Install it before running the application."
fi

echo ""
info "To run:  $OUTPUT_DIR/xdm-app"
