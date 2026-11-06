# Privacy — Snowline Lyrics 0.5.0

The application reads Windows system media-session metadata: title, artist, album, playback status and available timeline. It does not capture audio, use the microphone, read player credentials, cookies or playlists, or collect telemetry.

Default network queries go to lrclib.net with song title, artist and optionally duration. Only if enabled, the secondary synchronized source sends title/artist to api.lrc.cx; only if enabled and prior sources have no usable results, ordinary-lyric fallback sends title/artist to api.lyrics.ovh. These HTTPS services receive normal connection information, including IP address. No local image, file path or lyric-library file is uploaded. No account or API key is required by this implementation.

The Rust edition stores its library, appearance (including resized local images), provider switches and window preferences in `%APPDATA%/SnowlineLyricsRust`. On first run it copies existing known configuration files from `%APPDATA%/SnowlineLyrics` into this independent directory if the destination files do not exist. Old files remain untouched. Delete the Rust data directory after exiting the app to clear its saved data.

Background images are resized in the UI to at most 1600 pixels on the longest side and encoded as JPEG, stored locally in appearance.json. Imported lyrics and matched lyrics remain local; providers are queried with metadata, not the user's imported lyric file.

The interface is local and uses Tauri IPC; there is no listening loopback HTTP server or remote web content. Diagnostic desktop tests use an explicitly selected isolated profile and original test text; diagnostic options are not enabled during normal use. Song content and user profiles are excluded from source/release archives.
