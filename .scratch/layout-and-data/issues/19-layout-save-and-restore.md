# 19: The Layout is saved, restored and survives a restart

**What to build:** Part two of the docking Layout (part one is ticket 08). The arrangement the person makes (which Panels are shown, where each one sits, the splits, the tabs, the sizes) is described as plain data, written when it changes and restored when aidea is opened again. A saved Layout that mentions a Panel that no longer exists is cleaned of it before it is restored (the library's own restore fails and empties the window on one unknown id), and a Layout that cannot be restored for any reason falls back to the default Layout instead of an empty window. Layouts saved by earlier versions (the sizes and folded flags of the fixed grid) still load into the new arrangement.

**Blocked by:** 08 (the docking engine).

**Status:** ready-for-agent

- [ ] The Layout is a serialisable description (a small tree of splits and groups of Panel ids with sizes), the same on every restart; two reads of the same arrangement give the same data.
- [ ] Closing and reopening aidea brings back the arrangement the person left, including a Panel moved to another group and a Panel that was hidden.
- [ ] A saved Layout with an unknown Panel id loads without it; a Layout that cannot be restored, or is not valid data at all, gives the default Layout and never an empty window (a test on the page feeds it each of those).
- [ ] A layout saved by the version before this one (the `<id>Folded` flags and sizes) still loads and gives the arrangement it described.
- [ ] A Panel that depends on something (Run) is restored as hidden until it is available, and a Panel declared after the Layout was saved appears in its default place.
- [ ] Verified live: arrange, close, reopen; screenshots in the ticket.
