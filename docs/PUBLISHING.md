# Publishing the Rust edition

1. Update package.json, package-lock.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json versions. Commit the updated Cargo.lock.
2. Run npm test, npm run check and npm run audit:source. Build with npm run build.
3. Run node scripts/rust-desktop-check.mjs src-tauri/target/release/snowline-desktop.exe in an interactive Windows session. Use the native --media-check option for read-only system integration verification.
4. Run npm run package:windows and node scripts/export-source.mjs. These export only reviewed code, the release executable, documentation and dependency license notices.
5. ZIP the portable directory and clean source directory. Generate SHA-256 checksums. Never ZIP the entire working tree or user profile.
6. Push the reviewed commit and tag. Publish the portable ZIP, source ZIP and checksum file in GitHub Releases. Initial Rust versions should be marked as previews until users have tested upgrades and their own players.

Do not replace a published release's executable silently. Keep the previous stable release available for rollback. The application uses the independent SnowlineLyricsRust profile and copies known legacy settings without modifying the old profile.
