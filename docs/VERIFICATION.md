# Local verification — 2026-10-22

Environment: Windows 11 x64, Node 24.11.1, Electron 43.3.0, .NET Framework C# compiler and locally installed Windows SDK metadata.

- 17 automated tests passed: LRC parsing/translation timestamps, position interpolation, pause/seek, matching and version safety, lookup races/caching/retries, authenticated local APIs, and native session selection/adapter behavior.
- JavaScript syntax checks passed.
- The project's compiled read-only native helper returned actual system-player song metadata and a valid playing timeline on this machine.
- The source application and portable executable both passed desktop checks using an isolated profile and original demonstration lyrics: board rendering, settings, pin IPC, local LRC import, pause, seek, timing offset, renderer sandbox, and normal shutdown.
- The portable desktop test used a PATH containing Windows System32 only, with its own bundled Electron executable. It did not depend on Node or any desktop-pet installation at runtime.
- The release package excludes node_modules, vendor code, pet art, personal state and real song lyrics. Source exports use an explicit allowlist and credential/path pattern checks.
- The README preview is an actual application screenshot showing original demo text, not a photograph of the user's desktop.

The original-text desktop tests use a deliberate test fixture. They demonstrate UI/synchronization behavior, not actual LRCLIB catalogue coverage for every song. Real-provider lookup and system media integration derive from the previously verified lyrics prototype; no new claim of universal player compatibility is made here.

Not yet verified: execution on Windows 10, each other individual music player, hosted GitHub Actions execution, signed distribution, independent security review. The repository workflow is prepared but has not run in a GitHub repository.
