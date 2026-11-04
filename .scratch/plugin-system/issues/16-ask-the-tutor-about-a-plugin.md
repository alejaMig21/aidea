# 16: Ask the Tutor about a plugin

**What to build:** From the manager the person asks the Tutor whether installing a plugin is a good idea. The Tutor reads the plugin in the quarantine as untrusted data, with the scan result, and answers in plain words. It advises and never decides, and has no means to install.

**Blocked by:** 05, 06.

**Status:** ready-for-agent

- [x] The Tutor gets a read-only means to read a quarantined plugin and its report.
- [x] Text inside the plugin that looks like an instruction is treated as data (a fixture proves it).
- [x] The Tutor has no tool that installs, enables or removes.
- [x] Core API tests with a fake Tutor pass; `npm run verify` is green.

Note: the "Ask the Tutor" button in the manager is not built yet (needs a plugin payload in the Tutor class start); the Tutor tool and its tests are.
