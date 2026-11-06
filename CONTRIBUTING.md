# Contributing

The current codebase uses Rust + Tauri 2 and a plain HTML/CSS/JavaScript interface in web/. Rust timing logic lives in rust/core, desktop integration and backend logic in src-tauri/src.

Use Rust 1.99.1 or a compatible newer toolchain, MSVC C++ tools, Windows SDK and WebView2. Node.js 22+ is needed only for developer scripts.

Run cargo tests for rust/core and src-tauri, npm run check, npm run audit:source, and the native desktop checks before submitting changes. Desktop checks use original lyric text and an explicitly isolated profile; do not use production profile data in tests. See docs/VERIFICATION.md.

Keep media access read-only. New lyric providers must be opt-in unless agreed otherwise, send only necessary metadata, preserve candidate provenance, bound network responses and respect rate limits. Never add music, real song lyric fixtures, user caches, secrets or pet assets.
