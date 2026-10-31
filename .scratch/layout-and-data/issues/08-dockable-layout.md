# 08: Panels can be docked freely

**What to build:** The six Panels (Canvas, Files, Code, Builder, Tutor, Run) can be shown or hidden, resized by dragging their borders, placed side by side or stacked, nested, and grouped as tabs. Dragging a Panel by its title shows where it will land. A Panel has a usable minimum size and says so rather than breaking. The default Layout looks like today's window. Dragging and resizing feel smooth. Built with the engine chosen in ticket 07.

**Blocked by:** 07 (docking engine decision), 18 (Panel registry and the Panels menu: docking works on declared Panels, not on a hand-wired list).

**Status:** ready-for-agent

**Decided (ADR 0007, accepted 2026-10-31):** built on `dockview-core`, vendored in the repository (the script and its CSS copied in with the MIT licence, no network, no runtime dependency in `package.json`); `dockview-enterprise` is not used. What the ticket must handle because of that choice: a registry declaration (ticket 18) becomes a dockview panel; `defaultRenderer: "always"` so hidden Panels keep their scroll and zoom; every minimum padded by the library's 8 px gap; a saved Layout filtered of unknown Panel ids before it is restored, and a failed restore falls back to the default Layout instead of an empty window; the library's 166 KB of CSS overridden onto the shared scale, with a row added to `docs/agents/ui-style.md` for what the overrides cannot reach (close buttons, tab geometry) in the same commit; the narrow-window drawers rewritten; the default Layout looks like today's window; smoothness measured again on the real Electron window at 1x (the spike saw dropped frames only under 4x CPU throttling).

- [ ] Each Panel can be hidden and shown again from a visible control.
- [ ] Resize, side by side, stacked, nested and tabs all work with all six Panels.
- [ ] Drag to a new place shows a preview of the landing spot.
- [ ] No Panel can be squeezed below its minimum; the Canvas never disappears by accident.
- [ ] The default Layout matches today's window at 1920 and 1280.
- [ ] Smoothness is measured on real use and written in the ticket (not only that it works).
- [ ] The Layout is a serialisable description (this is what ticket 09 stores).
