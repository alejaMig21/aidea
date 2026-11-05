# 07: A plugin can ship a variant per system and use a program that is already on the machine

**What to build:** The way VS Code gets a language's program to the person, in aidea's plugin system. (1) The manifest can list variants of a plugin, each for some operating systems and processors; aidea picks the one that matches the machine, and when none does, the plugin manager says in plain words that the plugin is not available for this system; nothing breaks. (2) A plugin can declare that it needs a program already on the machine (a name, how to find it, the version it wants); aidea checks and, if it is missing, says what is missing and how to get it. (3) A plugin can declare a download it wants to make on first use (what, from where, how big, a hash); aidea asks the person, shows the details and downloads only after a confirmation, and checks the hash. All three are capabilities the scan shows. Nothing of this runs during quarantine.

**Blocked by:** language-plugins 01.

**Status:** ready-for-agent

- [ ] A fixture plugin with a variant for each system loads the one for this machine; with no matching variant it stays inactive and the manager says it is not available for this system.
- [ ] A fixture plugin that needs a program on the machine says clearly when it is missing and works when it is there.
- [ ] A download declared by a plugin asks the person first, shows what, from where and how big, refuses a file whose hash does not match, and never starts during quarantine (a fixture server proves it).
- [ ] The scan lists the three capabilities; a plugin that downloads or runs a program it did not declare is blocked.
- [ ] `docs/plugin-api.md` describes the manifest fields; core API tests pass; `npm run verify` is green.

Source: `.scratch/language-plugins/spec.md`, section "Decided".
