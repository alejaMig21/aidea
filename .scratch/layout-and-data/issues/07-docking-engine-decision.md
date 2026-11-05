# 07: Decide how the Layout is built: plain code or a docking library

**What to build:** A throwaway prototype of the hardest cases of a Unity-like Layout (resize, split side by side and stacked, nest, tabs, drag a Panel to a new place with a preview) built both ways, plain JavaScript and one candidate docking library, judged on smoothness, size, fit with the Electron app and ADR 0003's own criterion. The outcome is a new ADR that amends or supersedes ADR 0003. Nothing of the prototype is kept except the verdict.

**Blocked by:** 04 (Code panel: the six Panels exist).

**Status:** resolved: the person chose `dockview-core` (2026-10-31) because they want the second window in the first docking release, which was the spike's own flip condition (ADR 0007).

- [x] (closed 2026-11-04: decision made and built, the prototype branch is not needed) Both prototypes live on a `prototype/` branch and are measured on the same scenario (drag, resize, nested split) on the real window.
- [x] A recommendation with the numbers or observations behind it, and a DECISION line in the log for the person to confirm (DECISION 6, `.scratch/overnight/LOG.md` entry 21).
- [x] The ADR is written and ADR 0003 points to it (`docs/adr/0007-docking-layout-in-plain-code.md`, marked as a recommendation).
- [x] (closed 2026-11-04: dockview-core was chosen and built) Only the verdict is folded back into the main code. (Nothing under `src/` changed, but the prototype was kept under `.scratch/layout-and-data/spike-07/` as evidence rather than deleted; left open until the person says whether to keep it.)

The first box is also left open on purpose: the prototypes live in `.scratch/layout-and-data/spike-07/`, not on a `prototype/` branch, and were measured in headless Chrome, not in the real Electron window.

## Answer

Recommendation, to be confirmed by the person: build the docking Layout in plain code (ticket 08); keep ADR 0003. Full numbers in ADR 0007 and `spike-07/results.json`.

Measured (headless Chrome, 1920x1080, six heavy stand-in Panels, two runs at 1x and 4x CPU throttle):
- Size: plain 3 KB gzip; `dockview-core` 8.8.3 (MIT, maintained, no React) 106 KB gzip. Page load 131 ms against 270 ms (4x: 627 against 1,435).
- Dragging a Panel title across nested splits (stack, tabs, nest) with a landing preview: smooth in both, 0 frames over 25 ms, also at 4x.
- Dragging a splitter: smooth in both at 1x; at 4x plain 0 of 167 frames over 25 ms, dockview 10 of 192 (worst 50 ms) and 24 of 229 on the way back; an earlier run was worse for both (plain 10 and 3, dockview 21 to 61).
- Coverage: both do resize, split, nest, tabs, minimum sizes, serialise and restore. Only dockview did the second window (and back). Only plain code had keyboard-resizable splitters; dockview's keyboard docking is in `dockview-enterprise` (non-permissive npm licence). A dockview restore with one unknown Panel id throws and empties the window. Dockview counts minimum sizes with its 8 px gap.
- Fit: the existing card elements drop into both; the library's 166 KB of CSS needed 26 override lines and still left close buttons and tab sizes outside `ui-style.md`.

Not measured: the real Electron window, a real mouse (dockview's native drag and drop is only simulated), a second window in plain code, memory over time, how it feels in the hand. golden-layout 2 was not built (last release 2023). The prototypes are throwaway and were not tuned.
