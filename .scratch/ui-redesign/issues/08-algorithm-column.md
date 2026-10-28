# 08: Algorithm column in the right slot

**What to build:** Opening an Algorithm makes the Algorithm tab appear in the right slot and selects it by itself; leaving the Algorithm removes the tab. The column holds the test-data form, the optional own-Python switch with its existing warning, and the Playback (play, pause, step, scrub, values at each step). The Canvas keeps drawing the Algorithm graph. Narrow windows share the slot through tabs.

**Blocked by:** 05, 06

**Status:** done

- [ ] Opening an Algorithm shows and selects the Algorithm tab; leaving it removes the tab.
- [ ] Form, own-Python switch with warning, and Playback controls are all in that column.
- [ ] The own-Python choice and its warning behave as before.
- [ ] The Tutor tab is still one click away.
- [ ] Checked live on narrow and wide windows; result noted in the ticket.

## Review notes

Verified (none live): `npm run typecheck` and `npm test` pass (see commit). No core change, so no new automated test; the interface is plain browser code with no test seam.

What changed: `07-layout.js` gains `rightUnregisterTab(id)` (removes tab and pane; if it was selected the Tutor is selected) and `rightShowTab(id)` (unfolds the right slot, then selects). `60-playback.js` now renders the test-data form, the own-Python switch with its unchanged warning, and the Playback controls into its own pane, registered as the "Algorithm" tab while the Algorithms layer is shown and removed on any other layer. Proposals and Rationale still render in `#panel`, below the tabs, so they stay visible on every tab.

Needs live checking (left unticked): the Algorithm tab appears and is selected on opening an Algorithm (also with the slot folded); it disappears and the Tutor returns when leaving the Algorithms layer; form, own-Python switch, warning and Playback work inside the column; Tutor is one click away; a Proposal can still be decided while the Algorithm tab is open; narrow and wide windows (tall column scrolls in `#right-panes`, which shares height with `#panel`).

## Review fixes

- Switching Project clears Playback state and removes the Algorithm tab; `pbRender` is a no-op when the function no longer exists (no more TypeError).
- The Algorithm form is rebuilt only when the open graph changes, so typed values and the own-Python checkbox survive layer switches.
- UI-only changes, unverified live; no live criterion ticked.
