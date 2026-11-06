# Verification — 0.5.0 / 2026-11-07

Environment: Windows 11 x64, Rust 1.99.1, Tauri 2.12.5 and system Edge WebView2.

- Five Rust timing-core tests passed (repeated timestamps, Unicode, fractions, translations, offset, seek/pause and heartbeat limits).
- Seven Rust backend/protocol tests passed (appearance validation, plain/synchronized imports, manual alignment, stale revisions, persistence/reload, corrupt configuration fallback, conservative version confirmation and Retry-After throttling).
- Optimized release executable built successfully. It does not spawn Electron, Node or the old C# media helper.
- Desktop checks passed against the optimized executable and the portable package: native IPC, original LRC import/display, image conversion and removal, saved image name, colors across all board text, overlay presets, shadow, manual alignment/pause, full-text scrolling, offset and pin.
- Real Windows media API smoke check returned two sessions with zero read errors; only counts were logged.
- Fixed public HTTPS service probes returned valid JSON from LRCLIB (20 records), LrcApi (10 records) and lyrics.ovh (one response). No fetched lyric text was logged, saved or bundled. These are point-in-time connectivity checks, not coverage guarantees.
- Config migration reads and copies known files into the separate SnowlineLyricsRust directory; Electron's original profile is not written.

The renderer still uses WebView2 processes. Package size and executable size must not be confused with RAM use. Memory snapshots in test-results include the native process and its WebView2 descendants and may double-count shared pages; they are single-run observations, not a promised limit or a controlled Electron comparison.

The application remains an unsigned Windows preview. Windows 10 and every third-party player have not been tested individually. Synced lyric matching depends on available metadata and provider content.
