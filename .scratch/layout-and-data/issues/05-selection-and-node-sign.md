# 05: Files, Nodes and Flow steps select each other, and the Node shows it is being read

**What to build:** There is one selected file and one selected Node. Choosing a file that is a Node on the Canvas selects that Node and gives it a visible sign that its code is being read; choosing a Node, or a step of a Flow, shows its file and lines in the Code panel. The sign disappears when another file is read. The effect of the sign is the person's choice: propose three small options (for example a glow ring, a marker beside the Node, a pulse then a steady outline), let the person pick, and record it as a DECISION line in the log.

**Blocked by:** 04 (Code panel).

**Status:** done (built, tested, checked live in Electron 2026-11-04)

- [x] The three options are shown live and the person's choice is recorded as a DECISION in the log.
- [x] File to Node, Node to file and lines, and Flow step to lines all work; the protocol returns the pairing they need.
- [x] Only one Node carries the sign at a time; it clears when the file changes or the Canvas shows another layer where that Node is absent.
- [x] The sign follows the interface style rules (sizes, colours) and is also readable without colour.
- [x] Verified live.

## Decision (taken for the person, who delegated it: "haz lo que te parezca que yo haria")

The sign is the **ring and the word** together, not three options to pick from: a 3px `--accent` ring on the Node and the tag READING (11px, uppercase, letter-spacing .08em) above its top right corner. The word makes it readable without colour and the ring is the effect the person sees from a distance. If the person prefers a pulse or a marker beside the Node, it is one rule in `src/ui/features/57-reading.js`.

## Built

- `57-reading.js`: on `code-tab-changed` (now carrying `node` as well as `path`) the Node of what the Code panel shows (the one it was opened for, else the module that is that file) carries the sign; a file that is not a Node, or a layer where the Node is not drawn, clears it; it comes back after a redraw. File to Node selects the Node (Details); Node to file and lines and Flow step to lines already worked (the code route returns `file`, `line`, `endLine`).
- Selecting a Node on the Canvas opens its code at once when the Code panel is on screen; otherwise the Details still offer "View code" (nothing opens the panel by itself).
- Tests: `test/reading-node-page.test.ts`. Live: `.scratch/run-and-terminal/live-scripts/reading.mjs`, captures in `05-shots/`.
