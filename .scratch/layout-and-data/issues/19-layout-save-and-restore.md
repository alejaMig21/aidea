# 19: The Layout is saved, restored and survives a restart

**What to build:** Part two of the docking Layout (part one is ticket 08). The arrangement the person makes (which Panels are shown, where each one sits, the splits, the tabs, the sizes) is described as plain data, written when it changes and restored when aidea is opened again. A saved Layout that mentions a Panel that no longer exists is cleaned of it before it is restored (the library's own restore fails and empties the window on one unknown id), and a Layout that cannot be restored for any reason falls back to the default Layout instead of an empty window. Layouts saved by earlier versions (the sizes and folded flags of the fixed grid) still load into the new arrangement.

**Blocked by:** 08 (the docking engine).

**Status:** done (built, reviewed, verified live)

- [x] The Layout is a serialisable description (a small tree of splits and groups of Panel ids with sizes), the same on every restart; two reads of the same arrangement give the same data.
- [x] Closing and reopening aidea brings back the arrangement the person left, including a Panel moved to another group and a Panel that was hidden.
- [x] A saved Layout with an unknown Panel id loads without it; a Layout that cannot be restored, or is not valid data at all, gives the default Layout and never an empty window (a test on the page feeds it each of those).
- [x] A layout saved by the version before this one (the `<id>Folded` flags and sizes) still loads and gives the arrangement it described.
- [x] A Panel that depends on something (Run) is restored as hidden until it is available, and a Panel declared after the Layout was saved appears in its default place.
- [x] Verified live: arrange, close, reopen; screenshots in the ticket.

## Built (commit ffe4180 and the review fixes after it)
- `src/ui/features/07-layout.js`: `layoutSave` now also writes `dock` (the library's own description, saved after each change and at the end of `layoutApply`, never from a narrow window). `layoutClean` drops ids that are not in the window now (unknown, hidden, unavailable) and rescales the sizes of the siblings; `layoutRestore` falls back to the default arrangement on bad data or a failed restore; `layoutLegacySizes` applies the fixed-grid widths when there is no `dock`. A page that starts narrow keeps the saved arrangement as the stash and restores it when the window grows.
- Tests: `test/layout-save.test.ts` + `test/layout-save-page.js` (arrange, reopen with bad data, legacy, garbage read at start).
- Review found and fixed: narrow start overwrote the saved arrangement with the default; a leaf without a `panels` entry left an empty group and counted as restored; `NaN` size on a child without `size`.
- Known limit: a Panel folded for lack of room, or Run while no Flow is open, is not in `dock`, so it returns to its default place, not where it was.

## Live check (real Electron window, own --user-data-dir, closed and reopened)
- First attempt FAILED: the arrangement and even the folded flags were gone after a relaunch. Cause: the core listens on a random port, the window loads `http://127.0.0.1:<port>`, and `localStorage` belongs to one address, so every launch saw an empty store (two origins in the leveldb: :5573, :8548). This was true of every `localStorage` feature, not only the Layout. The headless page tests cannot see it (one page load each).
- Fix (decision: the core keeps it, not a fixed port): `PUT /ui/layout` stores the Layout in the core's preferences file under the key `~ui`; the page is served with it in `<meta name="aidea-saved">` (URI-encoded JSON); `layoutSave` writes both the core and `localStorage` (fallback and fixed-grid saves). `test/ui-state.test.ts` covers the route, a core restarted on another port, and text with a closing tag in it; `test/layout-save.test.ts` reopens on another address with nothing in `localStorage`.
- Second attempt: arranged (Files tabbed with the Builder, Code hidden, a border dragged with the mouse: Builder 367 -> 696 px), closed, reopened: same groups, Code still hidden, widths 697/415/557. Screenshots: `19-shots/1-default.png`, `2-arranged.png`, `3-reopened.png`.
- Still on `localStorage` only, so still forgotten at each relaunch of the desktop app: the notation switch, the playback speed, the Tutor sections' open state. Not part of this ticket.
