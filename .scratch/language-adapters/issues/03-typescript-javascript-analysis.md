# 03: TypeScript and JavaScript projects: modules, classes, functions and imports

**What to build:** The second adapter, the one that lets aidea read its own repository. For `.ts`, `.tsx`, `.js`, `.mjs` and `.cjs` files, the Components layer shows modules (files), classes, functions and methods, with the imports between files and the inheritance between classes, each relationship with its Resolution (an import that resolves to a file in the project is resolved, a call matched only by name is inferred, a dynamic one is unresolved). Calls between functions are included only where they are resolved by the compiler; the rest is left out and counted as unresolved. It uses the TypeScript compiler's API that the repository already has installed.

**Blocked by:** language-adapters 01.

**Status:** ready-for-agent

- [ ] Through the protocol on a small TypeScript fixture and a small plain JavaScript fixture: the expected modules, classes, functions, methods, imports and inheritance are returned with their Resolution, and the same Node and relationship shapes as the Python adapter.
- [ ] A syntax error in one file is reported as a problem for that file and the others are still analysed.
- [ ] The project's own `node_modules` and build folders are ignored.
- [ ] Opening the aidea repository itself returns a believable Components layer in a reasonable time (record the time).
- [ ] The TypeScript package is moved from a development-only dependency to a runtime one if the packaged app needs it; no other dependency is added.
