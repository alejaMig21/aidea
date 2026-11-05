# 03: TypeScript and JavaScript become a built-in plugin

**What to build:** `typescript-adapter.ts` and `typescript-flow.ts` move into a plugin that ships with aidea and is on by default. The hard part is the compiler: aidea uses TypeScript 7, a small JavaScript wrapper (about 3 MB) over a native program that is different for each operating system and processor (about 28 MB for Windows x64). It ships as a plugin with one variant per system, and each aidea installer includes the variant for its own system (ticket 07 gives plugins that ability).

**Blocked by:** language-plugins 01, language-plugins 02, language-plugins 07.

**Status:** ready-for-agent (the way the compiler travels was decided: the VS Code model, see the spec and ticket 07)

- [ ] The plugin has a variant for each of Windows, macOS and Linux (x64 and arm64) in its manifest, and the one for this machine is the one used.
- [ ] The plugin loads on by default and every existing TypeScript and JavaScript test passes untouched.
- [ ] The size of the plugin and of the installer is reported.
- [ ] A machine without the native program for its system gets a plain message, not a crash.
