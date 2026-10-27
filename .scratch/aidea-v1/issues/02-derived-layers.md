# 02: Derived layers complete

**What to build:** The Components and data layer shows classes as Nodes with their members instead of UML boxes, and the Code layer shows the exact source text. An "open in my editor" action on the Code layer opens the file in the person's own editor. When the person edits code by hand, the Derived layers recompute so the Canvas always matches the code.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A class appears as a Node with its methods and attributes as members.
- [ ] Zooming to the Code layer shows the real source text for the selected Node.
- [ ] "Open in my editor" opens the corresponding file at the right place.
- [ ] Editing a file in the fixture Project and asking the core to refresh changes the Derived layers accordingly.
