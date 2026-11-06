# 0.5.3

- Restore full-size board typography independent of compact window size.
- Add 24×24 native diagonal resize targets at each corner, keeping controls clear.

# 0.5.2

- Use a compact 400×180 default and minimum.
- Apply the requested size once on upgrade; preserve subsequent manual resizing.
- Adapt spacing, controls and lyric typography to compact windows.

# 0.5.1

- Remove the Windows undecorated-window white border/system shadow and redundant card outline.
- Use a taller 600×310 default; repair cramped legacy heights once while retaining larger custom sizes.
- Expand native drag regions across the board; keep buttons and full-text scrolling/selecting interactive.

# 0.5.0 — Rust + Tauri

- Replaced Electron, Node background service and C# media helper with Rust + Tauri and direct Windows media APIs.
- Preserved lyric modes, providers, local imports, candidate confirmation, overlays, colors, images, tray and pin controls.
- Added isolated Rust profile with read-only migration of previous settings.
- Switched builds, checks and source/portable packaging to Rust.

# 0.4.2

- 新增黑白背景遮罩、强度调节、35% 快捷选项和关闭按钮。
- 新增根据歌词颜色选择明暗的文字阴影开关。
- 遮罩与背景透明度独立控制，保存后重启恢复。

# 0.4.1

- 设置按外观、播放、歌词源、关于分组。
- 背景图片显示已保存文件名，重启后保留；兼容旧图片。
- 标题、按钮、底部状态与歌词颜色保持一致。

# 0.4.0

- 新增背景颜色、背景图片、背景不透明度与歌词颜色。
- 支持本地保存、移除图片及恢复默认。

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
