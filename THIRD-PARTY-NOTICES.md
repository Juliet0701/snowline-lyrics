# Third-party notices

Snowline Lyrics project code is MIT licensed. This does not license song lyrics, recordings, artwork or artist metadata.

The 0.5.0 runtime uses Tauri 2 (MIT OR Apache-2.0), Rust dependencies, Windows APIs and Microsoft Edge WebView2. WebView2 is supplied separately by Microsoft/the operating system and is not redistributed in this ZIP. The release includes `third-party-licenses.json` and copies of available dependency LICENSE/NOTICE/COPYING files in `third-party-licenses/`; dependency metadata identifies each package and its declared license. Source code, applicable license texts and notices remain available from those packages' repositories and crates.io. Build dependencies are also listed conservatively.

This release does not redistribute Electron, Node.js, the previous C# executable or desktop-pet assets. Older releases have their own included notices.

LRCLIB, the optional LrcApi public HTTPS endpoint (api.lrc.cx/jsonapi), and optional lyrics.ovh are remote services. No upstream server code, database or logos are included. Server open-source licenses and public endpoint access do not grant rights to lyric content. Returned candidate metadata may be inaccurate; users must select the correct recording/version and comply with applicable content rights and service terms. Only direct lyric text is accepted; returned remote paths and artwork are not downloaded.

Playwright Core is an Apache-2.0 development-only tool, not included in the portable runtime. Product names belong to their respective owners. The project is not endorsed by Microsoft, YouTube, Google or the lyric providers.
