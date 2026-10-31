# 06: Several files open as tabs in the Code panel

**What to build:** The Code panel holds several open files as tabs, with a refresh, and keeps "Open in my editor". The person can move between files and go back to where they were.

**Blocked by:** 04 (Code panel).

**Status:** resolved (headless Chrome against an in-process core; not run in the Electron window)

- [x] Opening a second file adds a tab; closing a tab shows the previous one (the tab shown before it, not the left neighbour). Measured: 5 tabs after 5 files (`pkg/app.py` is labelled with its path because `app.py` is open too); Delete and the x button each closed the shown tab and showed the one shown before it.
- [x] Each tab remembers the lines highlighted and the scroll position. Measured: long.py scrolled to 1200, other tab scrolled to 300, switching back restored 1200; long.py lines 150 to 152 stayed highlighted after visiting another tab and returning (scroll 2725 kept).
- [x] Refresh updates the shown tab from disk; a file that was deleted is shown as gone, not as an error page. Measured: after editing other.py and pressing Refresh the shown tab had the new 61 rows and kept its highlighted line; a deleted long.py (not the shown tab) is read again when its tab is shown and says "long.py is gone: it was moved, renamed or deleted. Close this tab, or press Refresh if you put it back."; putting the file back and pressing Refresh showed it again.
- [x] "Open in my editor" works from the Code panel with the existing editor settings, for any file shown there. Core: `POST /open-in-editor` takes `file` (path in the Project) with an optional `line` (default 1) instead of `node`; same path check as `GET /source?file=`, array arguments, no shell, same editor settings; a line that is not a positive whole number, a folder, a path outside the Project and a missing file never start the editor (`test/open-file-in-editor.test.ts`, 6 tests). Interface: one editor picker and button for the panel, sending the shown tab's file and first highlighted line; also offered for a file too big to show (the message says to use the editor); hidden for a file that is gone. Measured with a fake editor: other.py at line 10, big.txt at line 1.
- [x] Verified live. Headless Chrome (playwright-core) against an in-process core, 1920 and 1280 wide, screenshots looked at: no sideways overflow at 1280 (Files 232, Code 320, Tutor 280 px), no page errors (the only console lines are the expected 404 and 413 answers).

## What was built

Core: `src/core/routes/derived.ts`, the open-in-editor route accepts a file as an alternative to a Node.

Interface (`55-code.js`, `56-files.js` only): a tab strip (ARIA tablist, `role=tab` buttons with a separate close button, tabpanel per tab). Keys: Left, Right, Home, End move between tabs and show them; Delete closes. Middle click closes. One tab per file; choosing an already open file in Files shows its tab as it was (no reload, lines and scroll kept); a Node's code or a Flow step opens or updates the tab of its file and highlights its lines. The tab text is a sibling element per tab, so a scroll position survives. The Files panel marks the file of the shown tab (event `code-tab-changed`). Sizes and colours are on the shared scale (tabs 13px, `--muted`/`--text`, `--selected` and `--accent` for the shown one); no new row in `docs/agents/ui-style.md`.

Fixed on the way: `#pane-code` was `display: block`, so a file could not scroll inside it; it is now a flex column.

## Not measured

Electron window and a second monitor; a screen reader; 700 px (drawer) with several tabs; a refresh while a Flow step's lines are shown with several tabs open; dozens of tabs (the strip scrolls sideways, not tried past 5); the Details "View code" button (same function as before, not pressed); no automated test of the interface, only of the protocol. The layer bar is clipped at 1280 with Code open: ticket 11's problem.
