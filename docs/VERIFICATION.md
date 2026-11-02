# Verification — 0.4.2 / 2026-11-02

- 32 automated tests passed, including overlay validation and persistence across restart.
- Desktop checks exercise black/white 35% presets, custom strength, shadow, disabling and reset, as well as prior lyric flows.

# Verification — 0.4.0 / 2026-11-02

- 32 automated tests passed; 26 JavaScript files passed syntax checks.
- Packaged Electron desktop verification passed: colors, background-only opacity, valid PNG upload converted to local JPEG, successful image decoding, removal and reset. Existing lyric flows also passed.
- Appearance persistence verified across service restart using isolated temporary profiles. No real user settings changed.
- Local images are excluded from source export and portable packages.

# Verification — 0.3.0 / 2026-10-23

Environment: Windows 11 x64, Node 24.11.1, Electron 43.3.0.

- 30 automated checks passed, including existing automatic/manual/plain modes and new second-source parsing, opt-in, version confirmation, priority, schema/error handling and safe fallback.
- Syntax checks passed. Source/portable packaging audits exclude personal settings, caches, credentials and real fetched lyrics.
- Public service probes and the actual new JSON client returned valid timestamped candidates. See SECOND-SOURCE.md for limits and details.
- Desktop verification uses a private test profile, simulated media heartbeats and original lyric text. It checks the second-source switch, lookup, candidate selection and manual alignment in addition to earlier board functions.
- The simulated reader refreshes liveness without inventing progress in metadata-only mode. Production still uses the read-only native Windows media reader; no audio capture or playback control was added.

Actual test-player support remains limited to prior Windows 11 / YouTube Music PWA verification. This does not establish compatibility of every QQ Music version, Windows 10 or every song. Hosted GitHub Actions have not been executed by this local task. No security audit, signing or automatic-update claim is made.

Real fetched lyrics are absent from source, screenshots and releases. This release does not add a local directory scanner or a paid provider.
