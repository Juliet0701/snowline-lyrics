# Verification — 0.6.0 / 2026-11-12

- Based on the restored 0.5.1 baseline. Board CSS and drag markup are unchanged; window configuration differs only in the version field.
- Remote Windows workflow 43136668932 passed language checks, 13 Rust tests, syntax/source audit, optimized build and portable packaging. Runtime build commit: bc3e65613ffffc76fd10d6a4121b29b2711ef520.
- Browser localization checks passed for both settings and board, including English controls at the unchanged minimum window size.
- The downloaded artifact SHA-256 matched the GitHub workflow checksum before execution.
- Native desktop checks passed against that artifact: language changes in settings propagate to the board, English UI text coverage, language persistence after settings close/reopen, original song metadata and lyrics preserved (including lyric text identical to a UI translation key), manual alignment and pause preserved while switching languages, and existing images, colors, overlays, import, scrolling, offset and pin behavior.
- Language changes persist independently and do not cancel lyric searches. Unsupported locale preferences fall back to English. No translation API or new metadata transmission was added.
- Test profiles were isolated under the project workspace. No real song lyric content was bundled. Original 0.5.1 binaries and user configuration remain available for rollback.
- Compilation ran on GitHub rather than creating another multi-GB local target cache.

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

The settings lifecycle is asynchronous on Windows to avoid synchronous WebView2 construction deadlocks. Its close/reopen persistence test passed. One post-close test snapshot was 423 MiB across seven native/WebView2 processes with remote debugging enabled; this is not an idle baseline or a controlled comparison with Electron.
