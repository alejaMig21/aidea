# 01: Plugin API v0 and the glossary

**What to build:** A short document, `docs/plugin-api.md`, that fixes the first version of the public plugin API so every later ticket builds against it: the manifest fields, the kinds of named slot, the modes of events, the capabilities a plugin can declare, the list of required plugins, the support time for an old major version, and the style tokens a plugin interface may use. GLOSSARY.md gains Kernel, Plugin, Quarantine, Role, Instance and Provider, and reverses "Agent adapter, avoid: plugin". See `.scratch/plugin-system/spec.md` and ADR 0008.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] The document lists every manifest field, which are required, and the limits (icon size, no link leaving the folder).
- [x] It defines the API version scheme and the support time for the previous major version.
- [x] It defines the slot kinds and the first slot (the Panel), the event modes (announce, ask) and the capability names.
- [x] It names the required plugins and the style tokens that are part of the API.
- [x] GLOSSARY.md has the six new terms and the reversed Agent adapter entry; the glossary test still passes.
- [x] `npm run verify` is green.
