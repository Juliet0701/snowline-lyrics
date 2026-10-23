# Changelog

## 0.3.0 — 2026-10-23

- Added optional free, keyless LrcApi public synchronized-lyrics lookup before ordinary-text fallback.
- Kept public-source confirmation mandatory and preserved returned song/version metadata.
- Allowed timestamped fallback even when the primary provider returns usable plain text.
- Added separate persisted source toggles, failure/throttle handling, protocol-shape tests and desktop source-switch verification.
- Updated privacy, provenance and release documentation. No local LRC directory scan or paid provider integration was added in this release.

## 0.2.0 — 2026-10-23

- Added ↻ lyric lookup on the board, before the pin button, with loading and error feedback.
- Retained metadata-only media sessions and added line selection, manual lyric timing, pause/resume and safe reset on song/source changes.
- Added scrollable plain-lyrics reading from LRCLIB, optional lyrics.ovh fallback and local UTF-8 text imports.
- Kept backup lookup off by default, labeled provider/type and required confirmation for backup results.
- Updated privacy, attribution, release documentation and mode-specific tests.

## 0.1.0 — 2026-10-22

- First standalone Windows lyric-board release.
- Windows read-only media-session integration and timestamped LRCLIB lookup.
- Floating, resizable, pinnable board and tray settings.
- Local LRC import, candidate selection, timing offset and independent data directory.
- Source licensing, privacy documentation, release packaging and verification workflow.
