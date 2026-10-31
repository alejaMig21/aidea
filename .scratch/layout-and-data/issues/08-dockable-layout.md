# 08: Panels can be docked freely (the engine, with today's window as the default)

**What to build:** Part one of two (part two is ticket 19, saving and restoring the Layout). The Panels of the registry (ticket 18: Builder, Files, Code, Run, Tutor and the Canvas) are placed by `dockview-core` instead of the fixed grid: each can be shown or hidden from the Panels menu, resized by dragging its borders, placed side by side or stacked, nested, and grouped as tabs; dragging a Panel by its title shows where it will land; a Panel has a usable minimum size and says so rather than breaking. The default Layout looks exactly like today's window, and the things the person already relies on keep working: the Panels menu, the automatic fold of the least important Panels when there is no room, Run appearing only with a Flow, the drawers of a narrow window, the Canvas that can never disappear by accident. Nothing is saved or restored yet beyond what the interface remembers today: that is ticket 19.

**Blocked by:** 07 (docking engine decision, done), 18 (Panel registry and the Panels menu, done).

**Status:** built and reviewed; the Electron numbers below were taken by the person's session (see the last box)

**Decided (ADR 0007, accepted 2026-10-31):** built on `dockview-core`, vendored in the repository (the script and its CSS copied in with the MIT licence text kept in a notice file, no network, no runtime dependency in `package.json`); `dockview-enterprise` is not used. What this ticket must handle because of that choice: a registry declaration becomes a dockview panel (a new Panel is still one declaration); `defaultRenderer: "always"` so hidden Panels keep their scroll and zoom; every minimum padded by the library's 8 px gap; the library's 166 KB of CSS overridden onto the shared scale, with a row added to `docs/agents/ui-style.md` for what the overrides cannot reach (close buttons, tab geometry) in the same commit; the narrow-window drawers rewritten (the fixed grid and its drawers are replaced, not reused); smoothness measured again on the real Electron window at 1x (the spike saw dropped frames only under 4x CPU throttling).

**Not in this ticket:** keyboard control of splitters and moving a Panel by keyboard (ticket 11), the second window (ticket 10), saving, restoring and Presets (tickets 19 and 09).

- [x] The Panels are declared in the registry and placed by the library; a new Panel is still one declaration, and the page test of ticket 18 (seventh Panel) still passes.
- [x] Each Panel can be hidden and shown again from the Panels menu; the Canvas can never be squeezed below its minimum or hidden by accident.
- [~] Resize, side by side, stacked, nested and tabs all work with all the Panels.
- [x] Dragging a Panel by its title shows a preview of where it will land.
- [x] No Panel can be squeezed below its minimum.
- [~] The default Layout matches today's window at 1920 and 1280 (same Panels, order and widths within a few pixels), and Files and Code still start hidden. (Default: yes, exact at 1920 and within 2 px at 1280 and 1266. With Run open at 1280 it differs: Canvas 390 against 412 and Builder 270 against 260, because every minimum is padded by the library's gap.)
- [~] The automatic fold when there is no room, Run appearing only with a Flow open, and the drawers of a narrow window behave as before.
- [x] The library's look is on the shared scale (`docs/agents/ui-style.md` extended in the same commit); the MIT notice is in the repository.
- [~] Smoothness is measured on the real Electron window and written in the ticket (frames over 25 ms while dragging a splitter and a Panel), not only that it works. (Numbers below were taken by the person's session in the real window; I could not launch Electron myself, so the box stays at [~] until they are re-run on a build of the final code.)

## What was built

`src/ui/vendor/dockview/` holds `dockview-core` 8.8.3 unchanged (with `LICENCE.md` and `NOTICE.md`; not in `package.json`), served by `src/core/routes/ui.ts` at `/vendor/dockview/<file>` and loaded by a `<script src>` before the features. `07-layout.js` keeps the registry and the Panels menu; `layoutRegister` now creates the card and `layoutSync` adds or removes the dockview panel. The Canvas (`<main>`) is the panel `canvas`. Cards that are not in the Layout wait in a hidden `#dock-parking`, so the features still find their bodies by id. Tests: `test/docking.test.ts` and `test/docking-page.js` (headless Chrome, a wide and a narrow window), the vendor route in `test/protocol.test.ts`; `panel-registry` tests were adapted (the screen order is read by position, not DOM order).

## Decisions and deviations

- Registry minimum `min` is now the least width of the whole group (card plus its border): the library's gap of 8 px is added to it (`layoutMin`). The default weights (380, 800, 560, 420, 540) decide the widths while the person has not dragged a border and every group holds one Panel in one row; after the first drag, only a Panel that comes back is sized and the others keep the person's sizes (`layoutTouched`, in memory).
- Close buttons on tabs are hidden and the tab context menu is empty (hiding is from the Panels menu); a Panel removed by the library anyway counts as hidden. Floating groups are off.
- Where a hidden Panel returns is remembered in memory (its neighbour or tab group), else the registry position. Nothing about places is saved: only `<id>Folded` and `canvasFolded` as before. **The sizes a person dragged were remembered before this ticket and are NOT remembered after it, until ticket 19.** The old `sized` and weight keys stay in storage untouched (they are written back as they were) and are not applied; ticket 19 reads them straight from `localStorage`.
- Narrow window (below 760 px): only the Canvas is in the Layout; the requested card is mounted fixed over it as a drawer (title row `drawer-title`, Close, Escape, scrim, focus back). While the window is narrow the Layout is kept in memory with the library's `toJSON` and put back with `fromJSON` when the window is wide again (data produced a moment before from the same registry, never saved data), so tabs and sizes survive the trip; a Panel whose availability changed meanwhile is added or removed by the normal sync.
- Auto-fold keeps today's order and arithmetic (one column per Panel); a Panel stacked or tabbed is still counted as a column, so it may fold a little early. Not measured with stacked groups.
- Lost for now (ticket 11): the arrow keys on a separator (the library's sashes are not focusable) and moving a Panel by keyboard. Focus order follows the DOM, which with the library is not the screen order.
- After a border has really been dragged (`layoutTouched`, in memory, not reset in a session), showing a Panel no longer shares the room by weight, but the library then hands the new Panel room taken from its neighbours in its own way, so the other sizes are only roughly kept (the Builder at its minimum grew from 271 to 465 when Files was shown). Left as it is; to be settled with saving the sizes in ticket 19.
- `30-chat.js`: the textarea's resize observer now runs a frame later; with the Layout it raised "ResizeObserver loop completed" when a Panel was shown.
- While the Home screen is up the Layout stays laid out under it (`visibility: hidden`) so it does not lose its sizes.

## Measured in the real Electron window (visible, main monitor, widths by viewport, real mouse)

Taken by the person's session on the code of the first three commits. Default at 1266: Builder 271 / Canvas 581 / Tutor 383 against 268 / 581 / 384 before. A border drag: 0 of 140 frames over 25 ms, worst frame 17 ms. Dragging the Tutor tab onto the left edge of the Canvas: the landing preview was shown, the Panel moved, 0 of 18 frames over 25 ms. Files and Code from the menu with a Flow open: Run does not fit and folds on its own (same as before: it is the lowest-ranked of what is shown, with the Builder already folded). At 700 px the Tutor opened as a 360 px drawer. No page errors. After going back to a wide window the widths differ by a few pixels from before (Files 242 against 252, Tutor 300 against 290) because the weights apply again.

## Review (two fresh-context reviewers, Standards and Spec) and what was done

1. `layoutBusy` was never cleared if the library threw: fixed with `try/finally`; a test makes `addPanel` throw and checks the Layout still works. A library that fails to load: the Canvas is shown with a plain sentence (`#layout-notice`) and the other features go on; tested with the file answered 404.
2. A drawer open while the window grew wide was dropped with the focus on the page and the opener kept: now it is closed properly (focus to the Panels button, opener cleared); tested.
3. The Canvas could be dragged behind another Panel as a tab while the menu showed it checked: drops that put the Canvas in a group of tabs, or a Panel behind it, are cancelled (`onWillShowOverlay`); tested with drag events and a control drop that is still offered.
4. `layoutTouched` was set by any press on a border: now only when a drag changed a width (comment says it lasts until the page is reloaded). A Panel removed by the library itself is no longer saved as hidden: the next sync puts it back; tested.
5. Tabs and sizes lost on a wide-narrow-wide trip: kept with `toJSON`/`fromJSON` in memory (above); tested. The neighbour search (`layoutRemember`) stays, because it remembers where one hidden Panel goes back, which the whole-Layout `toJSON` cannot say.
6. Resize now runs the Layout once per animation frame.
7. `layoutSized` and `legacySize` deleted.
8. The white outline round the Canvas was the browser's own focus ring on the `svg` after a click (`:focus` without `:focus-visible`, drawn `auto`): turned off for a click, drawn inside (offset -2px, `--accent`) for the keyboard; a Focus section is in `docs/agents/ui-style.md`.
9. The vendor route reads inside `try/catch` (404 instead of an uncaught error) and sends `x-content-type-options: nosniff`.
10. The guide text no longer says "three panels side by side" or that Run opens "next to the Canvas"; it says panels can be dragged by their title, stacked or grouped as tabs.
11. Tests: added for 1 to 5 above; `pushed.touched` is not asserted any more (a press with no drag changes no width instead); the registry test no longer filters its expected order by what is on screen; fixed waits became waits for a condition where cheap.

## Measurements (headless Chrome 1x, widths of the group = old card width)

Today's window (main, before this ticket) against the Layout, default (Builder / Canvas / Tutor): 1920: 413 / 886 / 590 against 413 / 886 / 590; 1280: 271 / 588 / 389 against 271 / 588 / 390; 1266: 268 / 581 / 384 against 271 / 581 / 383. With Run open (Builder / Canvas / Run / Tutor): 1920: 329 / 709 / 372 / 470 against the same; 1280: 260 / 412 / 288 / 280 against 270 / 390 / 290 / 290 (the minimums are bigger by the gap, so the Canvas is 22 px narrower there). Real mouse (Playwright): a border dragged, a Panel dragged by its tab across the Canvas to its left (the drop preview showed), a Panel dropped on another tab bar to make tabs, hide and show, the drawer at 700 px, auto-fold at 1100, 900 and 780, Files and Code with a file open (Code keeps its scroll while another Panel is hidden), the Details in the Tutor: all worked and no page errors. Frames over 25 ms: border drag 0 of 122 (1x), 0 of 230 (4x CPU throttling); Panel drag 0 of 41 (1x), 4 of 55 at 4x (worst frame 67 ms). Screenshots were looked at.

Not measured: the real Electron window (last box stays open: the person's session measures frames there); a second monitor; a screen reader; stacked and nested groups under auto-fold; window drag-resizing in Electron.
