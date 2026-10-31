# 12: The Code layer is a real layer, and the floating code box goes away

**What to build:** The sixth layer, Code, shows the exact source text of the code behind whatever the person is looking at (user stories 16, 22 and 23 of the v1 spec). Today the Code tab is permanently disabled and a floating box with a snippet appears over the Canvas when a Node is selected; the box cannot be closed, belongs to no layer and stays over other layers. Replace both with one thing: the Code layer, a view in the Canvas area (not a floating box) that shows the whole file of the Node in focus, with line numbers and the Node's lines highlighted and scrolled into view, a header with the file and lines, and the existing "Open in my editor" with its editor picker.

How the person gets there, and back:
- The Code tab is enabled whenever a Project with code is open. With nothing in focus it says in one plain sentence how to pick something ("Select a class, function or module on Components, or open a step of an algorithm").
- Selecting a Node on Components does not open code by itself any more; the Code tab (or a "View code" action on the selected Node) does, and the view shows that Node.
- Double clicking a step of an Algorithm graph opens the Code layer at that step's lines (user story 16); the way back is the same tab of the layer it came from, and Escape.
- Switching to any other layer leaves the Code layer cleanly (no leftover box).
- A Node whose file is not readable (moved, too big, not text) shows a plain sentence instead of an empty view.

The floating box (`codeBox` in `src/ui/features/10-derived.js`) is deleted, including its uses in the Algorithm and refresh code.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Through the protocol: the source route can answer with the whole file of a Node plus its line range and, for an Algorithm step, the step's range; a file over a size cap (500 KB) is refused with a plain message; a path outside the Project, a symlink pointing out and a non-text file are refused; existing `/source` behaviour and tests keep working until the box is gone.
- [x] In the interface: the Code tab is enabled with a Project open; it shows the file with line numbers, the Node's lines highlighted and in view; changing layer and coming back keeps what was shown; Escape returns to the layer it came from; no floating box exists anywhere (rg finds no `codeBox`).
- [x] The layer has its legend behind "?" like the other layers (what the view shows, what it leaves out), the legend check test passes, and sizes and colours come from `docs/agents/ui-style.md` (the code font and size are the ones of the Algorithm trace table or the shared monospace role).
- [x] The layer is reachable by keyboard and its controls have accessible names; contrast at least 4.5:1.
- [x] Refresh (window focus or button) keeps the Code layer open on the same Node when it still exists and says so when it does not.
- [x] Verified headless at 1920 and 1280 on a Python project, on a TypeScript project (aidea's own `src`, a copy) and with the Canvas hidden; read screenshots.
- [x] Verified live on the second monitor, opening `D:\Projects\Telegram` read-only (no files written there), by selecting a component, opening Code, going back and opening a step of an algorithm.

## Verification notes (headless)

- Core: `/source` takes `whole=1` (entire file, the Node's lines to highlight) and optional `from` and `to` (a step's lines, checked against the file). A file over 500 KB answers 413, a file with a NUL byte 415, a file that is gone 404 (`locate` now tells "moved or deleted" apart from "outside the Project", which stays 403). Tests in `test/derived.test.ts`.
- Interface: new `src/ui/features/55-code.js`; `10-derived.js` and every use of `codeBox` are deleted (`rg codeBox src test` finds nothing). Selecting a Node shows "View code" in the right slot's Details area; the Code tab opens the selected Node, or what was shown before, or says how to pick something.
- Checked in headless Chrome at 1920x1080 and 1280x800, on the `flow` Python fixture and on a copy of aidea's own `src` in a temp folder: empty state, select then View code (lines highlighted and in view), legend, leave and come back (same view), Escape back to the layer it came from, Refresh on Code (same Node), renaming the function then Refresh (a plain sentence says it is gone), double click on an algorithm step (its line highlighted, "Back to Algorithms", Escape returns to the graph, the tab shows the step again), Canvas hidden and shown again (the Code layer is kept; the Code tab lives on the Canvas, so it cannot be reached while the Canvas is hidden).
- Found and fixed on the way: ligatures drew `==` and `=>` as joined glyphs (turned off, the text must be exact); double clicking an algorithm step also sent a focus request that failed with "layer must be one of ..." and left a red line (40-focus.js now ignores the Algorithms and Code layers); at 1280 the layer bar scrolls, so the layer on screen is scrolled into view.
- Not done: the live check on the second monitor (last box).

## Live check (2026-10-30, real Electron on the second monitor, `D:\Projects\Telegram` opened read-only; its `git status` is identical before and after)

- Code tab with nothing in focus: shows "Select a class, function or module on Components, or open a step of an algorithm."
- Module `scripts.live_probe` selected, "View code" pressed: file `scripts/live_probe.py`, line numbers, "lines 1 to 150" highlighted, editor picker, "Open in my editor", "Back to Components"; Escape returned to Components.
- Function `run_probe` opened (13 steps), double click on a step: Code layer at line 57 highlighted, "Back to Algorithms".
- Found and fixed: the Tutor column offered "Check what I know" for the Code layer (not a Tutor layer) and the request returned 400; the Probe offer now hides on Code and follows every layer change, however the layer is shown.
- Not fixed: the layer tabs scroll at 1264 px and "Business" is partly hidden (ticket v1-gaps/11); the Code tab cannot be reached while the Canvas is hidden.
