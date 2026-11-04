# 05: Quarantine and scan

**What to build:** A plugin added from a local folder or a Git link lands in a quarantine folder where nothing runs. Its manifest is read without executing code, and a scan with no model produces a report of findings that block and findings that warn.

**Blocked by:** 02.

**Status:** ready-for-agent

- [x] Adding a folder copies it into the quarantine; a Git link is probed first and fetched without running any script.
- [x] The report compares declared capabilities with the real use of the network, files, processes and the shell.
- [x] Blocking findings: obfuscated code, install scripts, hidden binaries, undeclared capabilities. Warnings: declared capabilities that are used. Icon limits and links leaving the folder are checked.
- [x] Nothing of a quarantined plugin runs (a fixture proves it by leaving a marker if it ever ran).
- [x] Core API tests with the fixture plugins pass; `npm run verify` is green.
