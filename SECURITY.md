# Security

Report vulnerabilities privately through GitHub Security Advisories for this repository. Do not post credentials or local lyric/profile files in public issues.

The Rust edition renders bundled local HTML and uses scoped Tauri commands. It does not load remote web pages or run a local HTTP server. Node integration and Electron are absent. Only known HTTPS lyric endpoints are queried; redirects and response-supplied remote file paths are not followed. JSON responses are bounded. Lyric text is displayed as text rather than HTML.

Windows media access is read-only. Background images are decoded locally, resized and validated; no local image or lyric file is sent to the providers. Release archives exclude personal profiles, caches and credentials. Rust builds use Cargo.lock. The portable executable is currently unsigned; verify the release SHA-256 checksum.
