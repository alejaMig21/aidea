# 08: Panels can be docked freely (the engine, with today's window as the default)

**What to build:** Part one of two (part two is ticket 19, saving and restoring the Layout). The Panels of the registry (ticket 18: Builder, Files, Code, Run, Tutor and the Canvas) are placed by `dockview-core` instead of the fixed grid: each can be shown or hidden from the Panels menu, resized by dragging its borders, placed side by side or stacked, nested, and grouped as tabs; dragging a Panel by its title shows where it will land; a Panel has a usable minimum size and says so rather than breaking. The default Layout looks exactly like today's window, and the things the person already relies on keep working: the Panels menu, the automatic fold of the least important Panels when there is no room, Run appearing only with a Flow, the drawers of a narrow window, the Canvas that can never disappear by accident. Nothing is saved or restored yet beyond what the interface remembers today: that is ticket 19.

**Blocked by:** 07 (docking engine decision, done), 18 (Panel registry and the Panels menu, done).

**Status:** ready-for-agent

**Decided (ADR 0007, accepted 2026-10-31):** built on `dockview-core`, vendored in the repository (the script and its CSS copied in with the MIT licence text kept in a notice file, no network, no runtime dependency in `package.json`); `dockview-enterprise` is not used. What this ticket must handle because of that choice: a registry declaration becomes a dockview panel (a new Panel is still one declaration); `defaultRenderer: "always"` so hidden Panels keep their scroll and zoom; every minimum padded by the library's 8 px gap; the library's 166 KB of CSS overridden onto the shared scale, with a row added to `docs/agents/ui-style.md` for what the overrides cannot reach (close buttons, tab geometry) in the same commit; the narrow-window drawers rewritten (the fixed grid and its drawers are replaced, not reused); smoothness measured again on the real Electron window at 1x (the spike saw dropped frames only under 4x CPU throttling).

**Not in this ticket:** keyboard control of splitters and moving a Panel by keyboard (ticket 11), the second window (ticket 10), saving, restoring and Presets (tickets 19 and 09).

- [ ] The Panels are declared in the registry and placed by the library; a new Panel is still one declaration, and the page test of ticket 18 (seventh Panel) still passes.
- [ ] Each Panel can be hidden and shown again from the Panels menu; the Canvas can never be squeezed below its minimum or hidden by accident.
- [ ] Resize, side by side, stacked, nested and tabs all work with all the Panels.
- [ ] Dragging a Panel by its title shows a preview of where it will land.
- [ ] No Panel can be squeezed below its minimum.
- [ ] The default Layout matches today's window at 1920 and 1280 (same Panels, order and widths within a few pixels), and Files and Code still start hidden.
- [ ] The automatic fold when there is no room, Run appearing only with a Flow open, and the drawers of a narrow window behave as before.
- [ ] The library's look is on the shared scale (`docs/agents/ui-style.md` extended in the same commit); the MIT notice is in the repository.
- [ ] Smoothness is measured on the real Electron window and written in the ticket (frames over 25 ms while dragging a splitter and a Panel), not only that it works.
