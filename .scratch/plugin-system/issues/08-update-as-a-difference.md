# 08: Update as a difference

**What to build:** A new version of an installed plugin goes to the quarantine and is compared with the accepted version; the manager shows only what changed. Nothing applies by itself, and an earlier confirmation of a blocking finding is not inherited.

**Blocked by:** 06.

**Status:** ready-for-agent

- [x] An update is never applied without the person's confirmation.
- [x] The report shows new files, new capabilities and new findings against the accepted version.
- [x] An update with nothing serious changed is one confirmation; one with a new blocking finding needs the named confirmation again.
- [x] Core API tests with two versions of a fixture plugin pass; `npm run verify` is green.
