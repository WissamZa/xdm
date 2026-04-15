# Known Issues & Technical Debt

| # | File | Issue | Impact | Fix Effort |
|---|---|---|---|---|
| 1 | `test/XDM.Tests/JsonParsingTest.cs` | Test reads `C:\Users\subhro\Desktop\message.json` | High | Low |
| 2 | `test/XDM_Tests/*.cs` | References old `XDM.Core.Lib.*` namespaces; tests don't compile | High | Medium |
| 3 | `NetFxHttpClient.cs` | Uses deprecated `ServicePoint` API | Low | Low |
| 4 | `XDM.Win.Installer/` | `binary-deps/` folder missing from repo | Medium | Medium |
| 5 | `WinHttpClient.cs` | TLS 1.0/1.1 still allowed | Medium | Low |
| 6 | `XDM.Gtk.UI.csproj` | Potential runtime trim failures with `PublishTrimmed` | Medium | Medium |
| 7 | `XDM.Compatibility` | Compatibility shims can be removed once all projects are on .NET 8 | Low | Medium |
| 8 | `XDM.Core/Interop.WinHttp/` | Dead code (WinHttp P/Invoke) | Low | Low |
| 9 | `app/packaging/deb/` | Icon theme paths may need distro-specific updates | Low | Low |
