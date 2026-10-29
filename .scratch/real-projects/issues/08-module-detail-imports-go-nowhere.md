# 08: In a module's detail, the imports are arrows that lead nowhere

**What to build:** Open `src/core/server` (or `typescript-adapter`) from the overview. The imports are short dashed arrows that leave the module box and stop in the air, each with a name cut to `src/core/ty...`; in `server` there are 17 of them stacked on top of each other, so the labels overlap and none can be read or clicked. A person cannot tell which module they point to. Draw the imports of a module as a short list on the module box (a compartment named "Imports", one line per imported module, in full, grouped when there are more than about 8), and make each line open that module (the same action as double-clicking its box in the overview). Keep the call arrows between the module's own functions as they are.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] In `src/core/server`, every import is readable in full and no two labels overlap, at 1920 and 1280 pixels wide.
- [ ] Clicking an import line opens the detail of that module; "All modules" returns to the overview.
- [ ] An import that is unresolved (a dynamic `import("typescript/...")`) is marked with the layer's unresolved sign and says why in its tooltip.
- [ ] The legend check passes (the new compartment has a legend row).
