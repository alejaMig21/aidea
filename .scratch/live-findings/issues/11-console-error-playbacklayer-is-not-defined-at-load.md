# 11: "playbackLayer is not defined" in the console on every page load

**What to build:** Found in the live pass of 2026-11-06: the browser console shows `ReferenceError: playbackLayer is not defined at stepRecording` on every load. In the code, `stepRecording` (`src/ui/features/48-stepmode.js` line 37) uses `playbackLayer`, which is declared later, in `src/ui/features/50-algorithm.js` line 175 (feature files are inlined in filename order), so a call during load happens before the declaration. Nothing visible broke in the pass, but the page must load with no console errors. Find who calls `stepRecording` during load (reproduce first), and fix it at the cause (declare the helper before its first use, or do not call it that early).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent (reproduce first)

- [ ] A page test fails today on the console error at load; `test/data-layer-page.test.ts` style (errors collected from the page) is enough.
- [ ] The page loads with no console errors.

Source: live pass 2026-11-06.
