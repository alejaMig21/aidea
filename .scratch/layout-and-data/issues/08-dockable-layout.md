# 08: Panels can be docked freely

**What to build:** The six Panels (Canvas, Files, Code, Builder, Tutor, Run) can be shown or hidden, resized by dragging their borders, placed side by side or stacked, nested, and grouped as tabs. Dragging a Panel by its title shows where it will land. A Panel has a usable minimum size and says so rather than breaking. The default Layout looks like today's window. Dragging and resizing feel smooth. Built with the engine chosen in ticket 07.

**Blocked by:** 07 (docking engine decision).

**Status:** ready-for-agent

- [ ] Each Panel can be hidden and shown again from a visible control.
- [ ] Resize, side by side, stacked, nested and tabs all work with all six Panels.
- [ ] Drag to a new place shows a preview of the landing spot.
- [ ] No Panel can be squeezed below its minimum; the Canvas never disappears by accident.
- [ ] The default Layout matches today's window at 1920 and 1280.
- [ ] Smoothness is measured on real use and written in the ticket (not only that it works).
- [ ] The Layout is a serialisable description (this is what ticket 09 stores).
