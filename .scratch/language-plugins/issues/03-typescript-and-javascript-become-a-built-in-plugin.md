# 03: TypeScript and JavaScript become a built-in plugin

**What to build:** `typescript-adapter.ts` and `typescript-flow.ts` move into a plugin that ships with aidea and is on by default. The hard part is the compiler: aidea uses TypeScript 7, a small JavaScript wrapper (about 3 MB) over a native program that is different for each operating system and processor (about 28 MB for Windows x64). The options and the recommendation are in the spec; the person chooses how it travels before this is built.

**Blocked by:** 01, 02

**Status:** needs-info: the person chooses how the TypeScript compiler travels with its plugin

- [ ] The way the compiler travels is chosen and written in this ticket.
- [ ] The plugin loads on by default and every existing TypeScript and JavaScript test passes untouched.
- [ ] The size of the plugin and of the installer is reported.
- [ ] A machine without the native program for its system gets a plain message, not a crash.
