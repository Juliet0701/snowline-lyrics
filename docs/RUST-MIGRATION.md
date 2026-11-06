# Rust migration

Branch migration/tauri-rust; rollback release v0.4.2 remains on main until final verification.

## Uploaded checkpoints

- 27e6676: independently tested Rust timing core.
- 2c492ef: Tauri windows, tray and native Windows media reader.
- 6302b1d: Rust lyric backend, cache/imports, manual clock and native IPC.

## Architecture

Windows Media.Control -> Rust media reader -> Rust state/lyric engine -> scoped Tauri commands -> bundled web UI in system WebView2.

No Electron, Node service, loopback HTTP server or C# helper participates in the new runtime. The previous implementation remains recoverable from Git history and local migration backups. HTML/CSS/JavaScript remains for rendering the UI; all application services and persistence run in Rust.

Configuration is saved under SnowlineLyricsRust. First launch makes a read-only copy of known files from SnowlineLyrics, leaving the old profile intact. No fetched lyrics or personal data are included in source exports.

Final verification and release packaging are recorded in VERIFICATION.md.
