# 08: In a module's detail, the imports are arrows that lead nowhere

**What to build:** Open `src/core/server` (or `typescript-adapter`) from the overview. The imports are short dashed arrows that leave the module box and stop in the air, each with a name cut to `src/core/ty...`; in `server` there are 17 of them stacked on top of each other, so the labels overlap and none can be read or clicked. A person cannot tell which module they point to. Draw the imports of a module as a short list on the module box (a compartment named "Imports", one line per imported module, in full, grouped when there are more than about 8), and make each line open that module (the same action as double-clicking its box in the overview). Keep the call arrows between the module's own functions as they are.

**Blocked by:** None.

**Status:** done

**Built:** `layoutModuleDetail` takes the import relationships out of the arrows and returns `imports[module] = {box, rows}`; the module package starts with an "Imports" box, one row per imported module (whole name, de-duplicated), grouped by folder when more than 8. Click or Enter on a row opens that module. A dynamic import shows `? dynamic import in loadRoutes()` with the reason as tooltip. Call stubs are unchanged (their cut labels in `server` are a separate matter).

- [x] In `src/core/server`, every import is readable in full and no two rows overlap, at 1920 and 1280 pixels wide (9 rows, 0 overlaps measured in the page, no import arrows).
- [x] Clicking an import line opens the detail of that module (`learner-pipeline`); "All modules" returns to the overview (headless Chrome, both widths).
- [x] An unresolved import is marked with `?` and says why in its tooltip (tooltip text tested at the core; mark seen in the screenshot).
- [x] The legend check passes (test run green). Note: that test draws a small project, so the new "Imports" legend row (only shown for an opened module) is covered by reading, not by the test.
