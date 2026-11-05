# 08: Update as a difference

**What to build:** A new version of an installed plugin goes to the quarantine and is compared with the accepted version; the manager shows only what changed. Nothing applies by itself, and an earlier confirmation of a blocking finding is not inherited.

**Blocked by:** 06.

**Status:** done (audit 2026-11-04: every box ticked, built and checked)

- [x] An update is never applied without the person's confirmation.
- [x] The report shows new files, new capabilities and new findings against the accepted version.
- [x] An update with nothing serious changed is one confirmation; one with a new blocking finding needs the named confirmation again.
- [x] Core API tests with two versions of a fixture plugin pass; `npm run verify` is green.

## Live check
Not verified live yet: the behaviour is covered by core API tests; the manager screen shows the update difference but that path was not clicked through in Electron.

Live check (2026-11-04, Electron, primary screen): the new version waited in the quarantine as a difference (1 added, 2 changed files) with an Update button; version 1 stayed until confirmed; since it had already run, version 2 waits for a restart and says so. Script: live-shots2/results.json (17 of 17).
