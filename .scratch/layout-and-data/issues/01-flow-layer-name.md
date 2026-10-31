# 01: The Algorithms layer is called Flow

**What to build:** The layer that draws the flowchart of one function is called Flow everywhere the person or the Tutor reads it: the Layer bar, the layer help and quick tour, the Legend, the Tutor's class messages, the open-function tab and the glossary. The protocol follows: the layer id is `flow`. Nothing the person has built is lost: Projects, recents and authored layers open as before.

**Blocked by:** None (can start immediately).

**Status:** resolved (commits 1d1b7c5, 8fcaa0e)

## Verification notes (2026-10-31)

Only the main monitor was active, so the live check ran headless (Chrome without a window, playwright-core, the real core, the `flow` fixture Project) at 1920x1080, 1280x720 and 900x700, not on the second monitor. Measured at all three widths: the layer help answers `Flow`; opening a function selects the `flow` layer and its tab reads `Flow: risky`; 12 steps are drawn; no old word in the Layer bar; no page errors. The only 404 in the console is `/favicon.ico`, which the core has never served. Screenshots: `flow-1920.png`, `flow-1280.png`, `flow-900.png` in the session scratchpad. At 1280 and 900 the Layer bar still scrolls sideways (the problem of the superseded ticket, now in `11-narrow-window-and-keyboard.md`). Not measured: a window on the second monitor, and the Electron shell itself. The right-slot tab still says "Algorithms" and its header "Algorithm" on purpose: ticket 02 renames them to Run.

- [ ] The layers list and the layer help answer with the id and name Flow, and no Algorithms layer.
- [ ] A test fails when "Algorithms" (as the layer name) or "Algorithm graph" appears in user-facing text.
- [ ] The glossary defines Flow and no longer defines the Algorithms layer; other glossary terms that depended on it are updated.
- [ ] The Tutor's layer class for Flow teaches with the new name.
- [ ] A Project opened before the rename still opens and shows its Flow.
- [ ] Verified live on the second monitor.
