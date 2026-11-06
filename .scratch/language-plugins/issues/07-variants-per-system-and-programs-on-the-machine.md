# 07: A plugin can ship a variant per system and use a program that is already on the machine

**What to build:** The way VS Code gets a language's program to the person, in aidea's plugin system. (1) The manifest can list variants of a plugin, each for some operating systems and processors; aidea picks the one that matches the machine, and when none does, the plugin manager says in plain words that the plugin is not available for this system; nothing breaks. (2) A plugin can declare that it needs a program already on the machine (a name, how to find it, the version it wants); aidea checks and, if it is missing, says what is missing and how to get it. (3) A plugin can declare a download it wants to make on first use (what, from where, how big, a hash); aidea asks the person, shows the details and downloads only after a confirmation, and checks the hash. All three are capabilities the scan shows. Nothing of this runs during quarantine.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-06 (variants, programs on the machine and downloads with permission)

- [x] A fixture plugin with a variant for each system loads the one for this machine; with no matching variant it stays inactive and the manager says it is not available for this system.
- [x] A fixture plugin that needs a program on the machine says clearly when it is missing and works when it is there.
- [x] A download declared by a plugin asks the person first, shows what, from where and how big, refuses a file whose hash does not match, and never starts during quarantine (a fixture server proves it).
- [x] The scan lists the three capabilities; a plugin that downloads or runs a program it did not declare is blocked.
- [x] `docs/plugin-api.md` describes the manifest fields; core API tests pass; `npm run verify` is green.

Source: `.scratch/language-plugins/spec.md`, section "Decided".

## What was built (2026-11-06)

A plugin can now get a program to the person in the three ways of the VS Code model. New module `src/core/plugins/programs.ts`; the manifest, the host, the scan, the routes and the interface use it.

- **Variants:** `variants: [{ os, cpu, folder }]`. aidea picks the one for this machine; the host half sees `ctx.variant.dir` (`null` when none is declared). With no match the plugin stays inactive and the manager says `not available for this system: it has variants for ...; this machine is win32 x64`.
- **Programs on the machine:** `programs: [{ name, command, args?, min?, help }]`, needs the capability `processes`. aidea runs `command args` (default `--version`) when the plugin is activated, reads the version and compares it with `min`. Missing or too old: inactive, with what is missing and `help`. `ctx.programs.run(name, args)` runs only a declared name (never a path) and resolves with `{ code, stdout, stderr }`.
- **Downloads:** `downloads: [{ name, os?, cpu?, url, bytes, sha256, file }]`, needs the capability `network`. `ctx.programs.download(name)` queues a question; the core shows it in its own dialog (`04-downloads.js`: what, from where, the address, the size; Not now has the focus first) and downloads only after Download. It does not follow redirects, stops at the declared size, checks the hash, writes to a temporary file and keeps nothing that does not match; the file lands in the plugin's data folder. A file already there with the right hash is returned without asking. Routes: `GET /plugins/downloads`, `POST /plugins/downloads/answer`. Only https is allowed, and plain http from this machine for tests.
- **Quarantine:** the manifest is only read; nothing is checked, run or downloaded there (a test proves the server is not asked).
- **Scan:** lists the three declarations as warnings; code that calls `ctx.programs` with neither `programs` nor `downloads` declared is blocking. A compiled program inside the plugin folder stays a blocking finding of its own (confirmed by name when installing).
- **Found on the way:** `body:has(#home:not([hidden])) > :not(#home, #dock)` hid every dialog of aidea on the Home screen; `.dialog-layer` is now exempt.

Tests: `test/plugin-programs.test.ts` (11). `npm run verify`: 1058 pass, 0 fail. Looked at live in Chromium through Playwright (the dialog, then Download: the file arrived, the hash held); `.scratch/language-plugins/live-scripts/serve-download.mjs` serves it.

Not here: signing and notarizing on macOS, a catalogue, and any plugin that really uses it (the TypeScript plugin with variants is language-plugins 03).
