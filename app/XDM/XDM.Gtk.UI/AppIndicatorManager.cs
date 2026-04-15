using System;
using System.IO;
using System.Runtime.InteropServices;
using Gtk;
using TraceLog;

namespace XDM.GtkUI
{
    /// <summary>
    /// System-tray / notification-area icon manager.
    ///
    /// Priority:
    ///   1. libayatana-appindicator3  — Wayland-native via StatusNotifierItem D-Bus protocol
    ///                                   (KDE Plasma, GNOME with extension, XFCE, etc.)
    ///   2. libappindicator3          — Legacy Ubuntu/Unity app-indicator (still common)
    ///   3. GTK StatusIcon            — X11 system tray fallback (Xfce, LXDE, old GNOME)
    ///
    /// The manager owns the tray-context Menu and fires <see cref="ShowWindowRequested"/>
    /// when the user wants to bring the main window forward.
    /// </summary>
    internal sealed class AppIndicatorManager : IDisposable
    {
        // ── State ────────────────────────────────────────────────────────────────
        private IntPtr      _handle       = IntPtr.Zero;
        private StatusIcon? _gtkIcon;
        private Menu?       _trayMenu;
        private bool        _useIndicator;
        private string?     _activeLib;
        private bool        _disposed;

        // ── Callbacks supplied by the caller ─────────────────────────────────────
        private readonly Action _onShow;
        private readonly Action _onNewDownload;
        private readonly Action _onExit;

        // ── Public event ─────────────────────────────────────────────────────────
        public event EventHandler? ShowWindowRequested;

        // ── Constructor ──────────────────────────────────────────────────────────
        public AppIndicatorManager(string baseDirectory, Action onShow, Action onNewDownload, Action onExit)
        {
            _onShow        = onShow;
            _onNewDownload = onNewDownload;
            _onExit        = onExit;

            // 1. Ensure a proper XDG icon-theme directory exists so AppIndicator
            //    can locate the icon by name instead of by path.
            var iconThemePath = PrepareIconTheme(baseDirectory);

            // 2. Build the right-click context menu (works with all backends).
            _trayMenu = BuildTrayMenu();

            // 3. Pick the best available backend.
            if (TryInitIndicator("libayatana-appindicator3.so.1", iconThemePath) ||
                TryInitIndicator("libappindicator3.so.1",         iconThemePath))
            {
                _useIndicator = true;
            }
            else
            {
                // Fall back to the old GTK StatusIcon (X11 system-tray protocol).
                TryInitStatusIcon(baseDirectory);
            }
        }

        // ── Icon-theme helper ─────────────────────────────────────────────────────
        /// <summary>
        /// AppIndicator resolves icons by name through the XDG icon-theme mechanism.
        /// We create a minimal "hicolor" theme sub-tree inside the application's
        /// directory so the icon can be found without system-wide installation.
        /// </summary>
        private static string PrepareIconTheme(string baseDir)
        {
            var themePath = Path.Combine(baseDir, "icons");
            try
            {
                // AppIndicator typically requests 22x22 or 24x24 from the panel,
                // but placing the 512-px source in every standard slot is fine —
                // the compositor will scale it.
                foreach (var size in new[] { "16x16", "22x22", "24x24", "32x32", "48x48", "64x64", "128x128", "512x512" })
                {
                    var dir = Path.Combine(themePath, "hicolor", size, "apps");
                    Directory.CreateDirectory(dir);
                    var dst = Path.Combine(dir, "xdm-app.png");
                    var src = Path.Combine(baseDir, "xdm-logo-512.png");
                    if (!File.Exists(dst) && File.Exists(src))
                        File.Copy(src, dst);
                }
            }
            catch (Exception ex)
            {
                Log.Debug(ex, "AppIndicatorManager.PrepareIconTheme failed");
            }
            return themePath;
        }

        // ── Backend initialisation ────────────────────────────────────────────────
        private bool TryInitIndicator(string lib, string iconThemePath)
        {
            try
            {
                // Probe: will throw DllNotFoundException if the .so is absent.
                var ptr = NativeIndicator.Create(lib, "xdm-app", 0 /* APPLICATION_STATUS */);
                if (ptr == IntPtr.Zero) return false;

                NativeIndicator.SetIconThemePath(lib, ptr, iconThemePath);
                NativeIndicator.SetTitle(lib, ptr, "Xtreme Download Manager");
                NativeIndicator.SetStatus(lib, ptr, 1 /* ACTIVE */);

                if (_trayMenu != null)
                    NativeIndicator.SetMenu(lib, ptr, _trayMenu.Handle);

                _handle    = ptr;
                _activeLib = lib;
                Log.Debug($"AppIndicatorManager: using {lib}");
                return true;
            }
            catch (DllNotFoundException)
            {
                Log.Debug($"AppIndicatorManager: {lib} not found, skipping");
                return false;
            }
            catch (Exception ex)
            {
                Log.Debug(ex, $"AppIndicatorManager: failed to init {lib}");
                return false;
            }
        }

        private void TryInitStatusIcon(string baseDir)
        {
            try
            {
                Log.Debug("AppIndicatorManager: falling back to GTK StatusIcon");
                var iconPath = Path.Combine(baseDir, "xdm-logo-512.png");
                var pixbuf   = File.Exists(iconPath)
                    ? new Gdk.Pixbuf(iconPath, 48, 48)
                    : Gtk.IconTheme.Default.LoadIcon("application-x-executable", 48, 0);

                _gtkIcon = new StatusIcon(pixbuf)
                {
                    Tooltip = "Xtreme Download Manager",
                    Visible = true
                };
                _gtkIcon.Activate   += (_, _) => _onShow();
                _gtkIcon.PopupMenu  += OnGtkIconPopupMenu;
            }
            catch (Exception ex)
            {
                Log.Debug(ex, "AppIndicatorManager: StatusIcon fallback also failed");
            }
        }

        // ── Tray menu ────────────────────────────────────────────────────────────
        private Menu BuildTrayMenu()
        {
            var menu = new Menu();

            var itemOpen = new MenuItem("Open Xtreme Download Manager");
            itemOpen.Activated += (_, _) => _onShow();
            menu.Append(itemOpen);

            menu.Append(new SeparatorMenuItem());

            var itemNew = new MenuItem("Add New Download…");
            itemNew.Activated += (_, _) => _onNewDownload();
            menu.Append(itemNew);

            menu.Append(new SeparatorMenuItem());

            var itemExit = new MenuItem("Exit");
            itemExit.Activated += (_, _) => _onExit();
            menu.Append(itemExit);

            menu.ShowAll();
            return menu;
        }

        private void OnGtkIconPopupMenu(object? sender, PopupMenuArgs e)
        {
            _trayMenu?.Popup();
        }

        // ── Dispose ───────────────────────────────────────────────────────────────
        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _gtkIcon?.Dispose();
            _trayMenu?.Destroy();
        }
    }

    // =========================================================================
    // NativeIndicator — thin dynamic-dispatch P/Invoke shim
    //
    // We load the library by name (whichever .so won the probe race) and
    // forward calls through NativeLibrary so we never hard-code a specific
    // DllImport lib string at compile time.
    // =========================================================================
    internal static class NativeIndicator
    {
        // Delegate signatures matching the C API
        private delegate IntPtr  d_create(
            [MarshalAs(UnmanagedType.LPUTF8Str)] string id,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string icon,
            int category);

        private delegate void d_set_status(IntPtr self, int status);
        private delegate void d_set_menu(IntPtr self, IntPtr menu);
        private delegate void d_set_str(IntPtr self,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string value);

        // ── Public facade ─────────────────────────────────────────────────────
        public static IntPtr Create(string lib, string iconName, int category)
        {
            var fn = GetExport<d_create>(lib, "app_indicator_new");
            return fn(iconName, iconName, category);
        }

        public static void SetStatus(string lib, IntPtr ptr, int status)
            => GetExport<d_set_status>(lib, "app_indicator_set_status")(ptr, status);

        public static void SetMenu(string lib, IntPtr ptr, IntPtr menuHandle)
            => GetExport<d_set_menu>(lib, "app_indicator_set_menu")(ptr, menuHandle);

        public static void SetIconThemePath(string lib, IntPtr ptr, string path)
            => GetExport<d_set_str>(lib, "app_indicator_set_icon_theme_path")(ptr, path);

        public static void SetTitle(string lib, IntPtr ptr, string title)
            => GetExport<d_set_str>(lib, "app_indicator_set_title")(ptr, title);

        // ── Helpers ───────────────────────────────────────────────────────────
        private static T GetExport<T>(string lib, string symbol) where T : Delegate
        {
            var hLib = NativeLibrary.Load(lib);
            var addr = NativeLibrary.GetExport(hLib, symbol);
            return Marshal.GetDelegateForFunctionPointer<T>(addr);
        }
    }
}
