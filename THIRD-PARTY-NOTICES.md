# Third-party notices

## Project code

Snowline Lyrics application code, the read-only C# media reader and the simple geometric icon are maintained as this project's own work under the repository's MIT LICENSE. The application is a standalone lyric board. Its source package contains the application, tests, documentation and original geometric icon.

## Electron runtime

Portable builds bundle Electron 43.3.0: https://github.com/electron/electron

Electron is distributed under the MIT license. Its original `LICENSE` and `LICENSES.chromium.html` files are preserved at the portable package root. These contain Electron's notices and third-party notices for Chromium and other bundled components. The separate `LICENSE-Snowline-Lyrics.txt` applies to this application, not to every bundled component.

Electron copyright: Electron contributors; 2013–2020 GitHub Inc.
License reference: https://github.com/electron/electron/blob/v43.3.0/LICENSE

## Development dependencies

- Electron npm tooling and its transitive dependencies: see package-lock.json and each installed package's license.
- playwright-core 1.56.1, Microsoft Corporation, Apache-2.0: https://github.com/microsoft/playwright/blob/v1.56.1/LICENSE

These npm packages are used for development and testing; node_modules is not included in the portable application's resources/app directory. The Electron executable and its runtime components are bundled as described above. The application has no production npm dependencies.

## Windows APIs

The native helper calls Windows.Media.Control read-only system APIs. Windows and .NET Framework are operating-system prerequisites, not copied into this project. Windows SDK metadata is used only to compile the helper, not distributed with it.

API reference: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager

## LRCLIB and lyric content

LRCLIB provides remote timestamped lyric lookup: https://lrclib.net/docs
This application consumes its HTTP API; it does not incorporate LRCLIB server source code or a lyric database dump. No actual song lyrics, recordings, album art or artist photos are bundled in this repository or its portable release. Test fixtures and preview text are original demonstration text.

This project's MIT license does not license or grant rights in retrieved lyrics or other third-party content. Such content remains subject to its respective rights and applicable service rules. Access to a public API is not a blanket content redistribution license.

## Optional lyrics.ovh service

lyrics.ovh is a separate, opt-in remote plain-lyrics service. API documentation: https://github.com/NTag/lyrics.ovh#api
Endpoint: https://api.lyrics.ovh/v1/{artist}/{title}

The service publicly describes aggregation of LRCLIB and other lyric sites. This application consumes its public HTTP endpoint only and includes none of its server code. The MIT license on that server's software is not a license to redistribute lyric content. Retrieved content remains subject to its respective rights and service rules. The service has no reliability or catalogue-coverage guarantee from this project. A successful API probe does not establish rights in returned lyrics.

The source and portable archives contain only original test/preview text, not actual fetched song lyrics.

## Optional LrcApi public synchronized-lyrics service

Project and public-service documentation: https://github.com/HisAtri/LrcApi
Usage documentation: https://docs.lrc.cx/docs/QuickStart/
Public endpoint consumed by this client: https://api.lrc.cx/jsonapi

This is a separate optional service, off by default. The upstream project invites API integrations and documents a public service, while warning that it may be slow or inaccurate and obtains lyrics through other providers. Live probes returned valid timestamped LRC; this does not guarantee ongoing free access, catalogue coverage, matching accuracy or content-display rights.

This application contains its own small HTTP/JSON adapter only. It incorporates none of LrcApi's GPL-licensed server source, documentation text, logos, translation code or music assets. The upstream server's software license does not license retrieved lyric content. This project's MIT license remains limited to its own work; third-party lyrics remain subject to their respective rights and applicable service rules. No account, API key or paid service is provisioned by this application.

Candidate text is cached locally after user confirmation. No fetched real lyrics are included in the repository, source archive, previews or portable release.

## Names and affiliation

YouTube, YouTube Music, Google, Microsoft, Windows and other product or company names belong to their respective owners. This independent project is not affiliated with, endorsed by, or an official client of those owners or LRCLIB. Names are used only to explain compatibility and identify third-party services.
