# Second synchronized source — 0.3.0

LrcApi public service: https://github.com/HisAtri/LrcApi
Public usage documentation: https://docs.lrc.cx/docs/QuickStart/

The upstream project invites API integrations and documents a public endpoint with slow/inaccurate-result caveats. No credentials were supplied during these checks. Its paid subscription service is not used.

Read-only probes on 2026-10-23:
- The documented text endpoint returned HTTP 200 and 38 parsed timestamp entries for one sample, and HTTP 200 / 23 entries for another.
- The JSON candidate endpoint returned song, artist, album, duration and direct LRC content. It also returned different versions and instrumental records, demonstrating why confirmation is necessary.
- Our actual JSON client accepted 7 timestamped records for one probe and refused to select one automatically.
- Only metadata, counts and status were printed; real lyric text was not saved, screenshot or bundled.

The adapter sends title/artist only to a fixed HTTPS JSON endpoint, does not follow redirects or returned URLs, has a timeout and size/count bounds, supports the observed lrc field and older documented lyrics field, and honors Retry-After on errors. Malformed, plain-only and single-timestamp entries are rejected as a second synchronized source. Returned metadata is kept instead of replacing it with the request metadata.

Unit tests cover opt-in, fixed-host query construction, no path/link traversal, schema variations, source confirmation, primary plain-text coexistence, strong-primary short circuit and safe error fallback. Desktop fixtures test enabling the source, requerying, selecting its candidate and manually aligning it. UI text and screenshots use original material.

Public access and the upstream server's software license do not establish a license in lyric content. The application does not incorporate upstream server code or logos, does not bypass credentials or provision accounts, and offers no catalogue or availability guarantee.
