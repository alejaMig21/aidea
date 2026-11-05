# 04: The Contract and the Differences become a plugin

**What to build:** Move `contract.ts`, `drift.ts`, the Contract and Differences sections of the Tutor's panel and the Builder's `read_contract` tool into a plugin that ships with aidea. It offers a service (the agreed items, the differences), its own section, and a teaching surface (a lesson, a read-only view, named checks). The Tutor and the Builders use the service; the Tutor's own code no longer knows the Contract or the Differences by name. Behaviour unchanged: every existing test passes untouched. With the plugin off there is no Contract.

**Blocked by:** plugin-teaching 01, plugin-teaching 02

**Status:** ready-for-agent

- [ ] Every existing Contract and Differences test passes without being edited.
- [ ] The Tutor reads the Contract through the plugin's view and checks, and a search of the Tutor's code finds no direct use of the Contract or drift modules.
- [ ] With the plugin off the sections are gone, the Builder's `read_contract` says there is no Contract, and nothing breaks.
- [ ] The plugin ships a lesson and a teaching surface.
- [ ] Page tests for the moved sections pass.

Source: `.scratch/roles-and-contract/spec.md`.
