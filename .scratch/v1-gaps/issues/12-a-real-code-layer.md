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

**Status:** ready-for-agent

- [ ] Through the protocol: the source route can answer with the whole file of a Node plus its line range and, for an Algorithm step, the step's range; a file over a size cap (500 KB) is refused with a plain message; a path outside the Project, a symlink pointing out and a non-text file are refused; existing `/source` behaviour and tests keep working until the box is gone.
- [ ] In the interface: the Code tab is enabled with a Project open; it shows the file with line numbers, the Node's lines highlighted and in view; changing layer and coming back keeps what was shown; Escape returns to the layer it came from; no floating box exists anywhere (rg finds no `codeBox`).
- [ ] The layer has its legend behind "?" like the other layers (what the view shows, what it leaves out), the legend check test passes, and sizes and colours come from `docs/agents/ui-style.md` (the code font and size are the ones of the Algorithm trace table or the shared monospace role).
- [ ] The layer is reachable by keyboard and its controls have accessible names; contrast at least 4.5:1.
- [ ] Refresh (window focus or button) keeps the Code layer open on the same Node when it still exists and says so when it does not.
- [ ] Verified headless at 1920 and 1280 on a Python project, on a TypeScript project (aidea's own `src`, a copy) and with the Canvas hidden; read screenshots.
- [ ] Verified live on the second monitor, opening `D:\Projects\Telegram` read-only (no files written there), by selecting a component, opening Code, going back and opening a step of an algorithm.
