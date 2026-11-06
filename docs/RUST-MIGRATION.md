# Rust migration checkpoints

Branch: migration/tauri-rust. Stable release remains v0.4.2 on main.

## Checkpoint 1 — portable timing core

Added a standalone Rust crate with no runtime dependencies. Tested repeated timestamps,
Unicode, fractional seconds, LRC offset direction, merged translations, instrumental
cues, seeking, pause, duration clamping and stale-heartbeat extrapolation.

This is an internal migration checkpoint, not a replacement app or public release.
The existing Electron code remains runnable until all backend and desktop features
have equivalent implementations and packaged end-to-end verification passes.

## Remaining work

- Tauri desktop host: transparent board, settings window, tray, pin, positioning.
- Rust Windows media-session reader; retire the C# child process.
- Rust lyric providers, ranking, caching, imports, manual clock and persistence.
- Replace loopback HTTP/Node backend with scoped Tauri commands and events.
- Preserve user configuration; provide isolated test profiles and migration tests.
- Verify complete desktop behavior, compare memory/CPU and publish a prerelease.

Do not merge this branch or remove Electron dependencies before those checks pass.

## Checkpoint 2 — native desktop and media reader

The independent `src-tauri` preview uses system WebView2, scoped Tauri IPC and
Windows Media.Control directly from Rust. No Node or C# process is launched.
It provides transparent board/settings windows, tray show/settings/exit actions,
window dragging and pin toggling. The diagnostic UI in `rust-ui` deliberately
labels itself as a migration check and does not pretend to provide lyrics yet.

Preview configuration uses `io.github.juliet0701.snowline-lyrics.preview`; the
stable `%APPDATA%/SnowlineLyrics` data is not opened or modified. Native metadata
is read-only and is not sent to any network provider at this checkpoint.

Build/check commands (Rust MSVC toolchain and WebView2 required):

```powershell
cargo test --manifest-path rust/core/Cargo.toml
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo run --manifest-path src-tauri/Cargo.toml
# Native metadata smoke check without creating windows:
cargo run --manifest-path src-tauri/Cargo.toml -- --media-check
```

`main` and the Electron release remain supported during migration. The existing
HTML settings/board will replace the diagnostic UI once the Rust backend supports
all lyric, import, persistence and manual-timeline operations. This checkpoint is
not a public application release or a completed migration.
