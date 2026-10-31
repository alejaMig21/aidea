# 04: Code is a Panel, no longer a layer

**What to build:** Choosing a file in the Files panel shows its whole source in a Code panel, with line numbers and highlighted syntax. The Code layer, its tab and its help entries are gone from the Layer bar. The Code panel is reachable even when the Canvas is hidden. A file that is too large or not text is refused with a plain message. It reuses the existing source route (whole file, range, size cap, plain refusals).

**Blocked by:** 03 (Files panel).

**Status:** implemented (review pending)

- [x] The layers list and the layer help no longer contain Code; a test fails if a Code layer reappears. (`test/panels-vocabulary.test.ts`: no tab, layer id, legend or `showLayer("code")` in the interface; the layer help has no `code`; a class on `code` is refused.)
- [x] Choosing a file in Files shows its source in the Code panel; the Code panel can be shown or hidden on its own.
- [x] With the Canvas hidden, the Code panel still opens and works.
- [x] A large file and a binary file give the plain refusal, not a hang.
- [x] The change to a file on disk shows after a refresh. (The Refresh button reads the current file again.)
- [x] Everything the old Code layer did that the person used (highlighted lines from a Flow step, back, refresh) still works from the panel, or is explicitly moved to tickets 05 and 06. (Highlighted lines from a Flow step: kept. Refresh: kept. "Back to <layer>" and Escape: dropped, they only made sense for a layer. "Open in my editor": kept for a Node's code, not offered for a file chosen in Files: moved to ticket 06. The Code layer's legend went with the layer.)
- [~] Verified live at 1920, 1280 and narrow; screenshots in the ticket. (Done in the real Electron window on the main monitor, but the widths were set by resizing the viewport, not the window; screenshots are in the session scratchpad, not in the repository.)

## What was built

Core: `GET /source` accepts `file=<path in the Project, with />` as an alternative to `node=`. A file by path is always answered whole, with `from` and `to` to highlight lines, and with the same refusals (413 over 500 KB, 415 not text, 404 gone, 400 for a folder, 403 for anything outside the Project folder, including `..`, absolute paths and links that leave it). 5 protocol tests in `test/source-by-file.test.ts`.

Interface: Code is a card of its own (own top-bar button and separator) between Files and the Canvas, hidden by default, and it opens by itself when a file, a Node's "View code" or a Flow step is chosen (a drawer in a narrow window). It shows the whole file with line numbers, highlighted lines scrolled into view, and syntax colours for Python and TypeScript/JavaScript (keywords, strings, numbers, comments; `--syn-*` tokens added to the style scale, contrast 7.9 or more; coloured a line at a time, so a string or comment that spans lines is coloured wrongly after its first line, marked `ponytail:`; files over 4000 lines are shown plain). Choosing a file in the Files tree (click, Enter or Space) marks it and opens it. The layout code now handles five side panes, and margins and separators are computed in JS instead of CSS combinations. The Code layer, its tab, its legend and the Escape and Back controls are removed.

## Measurements (real Electron window, visible, main monitor, widths by viewport)

With a small project: the Layer bar lists components, business, requirements, architecture and flow, and no Code; Code starts hidden; choosing `app.py` opens it (Files 240 px, Code 405, Canvas 578 at 1920) with 5 lines and 2 keywords, 4 strings, 2 numbers and 1 comment coloured; a 600 KB file says "too big to show here", a binary file says "not text", a Markdown file shows plain; Enter on a file row opens it; after editing the file on disk and pressing Refresh the panel shows the new text; with the Canvas hidden choosing a file still opens it; dragging the Code separator 80 px to the right grew Code from 405 to 482 px; at 1280 and 1266 px the Builder folds on its own and Files, Code, Canvas and the Tutor stay (Canvas 408 and 394 px), no sideways overflow; at 700 px Code opens as a drawer and shows the text; a real double-click on a Flow step opened the Code panel on `more.py` with that step's line highlighted, and the layer stayed Flow; no page errors. The layer bar is cut ("Components" clipped) while Run is open next to Code at 1920: ticket 11's problem.

Not measured: a second monitor; the arrow-key move of the Code separator; syntax colours on a long real file; screen readers; "View code" from the Details panel (its code path is the one used by the Flow step, but the button itself was not pressed).
