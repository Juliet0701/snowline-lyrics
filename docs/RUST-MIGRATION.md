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
