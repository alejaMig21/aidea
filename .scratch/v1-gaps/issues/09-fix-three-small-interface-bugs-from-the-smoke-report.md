# 09: Three small interface bugs from the Electron smoke report

**What to build:** `open()` shadows `window.open` in `src/ui/features/00-canvas.js`; the layer bar is clipped at 1280 px; the validation block overlaps the Requirements header. Re-check each first: some may already be gone.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Each defect is either reproduced and fixed with a screenshot at 1920 and 1280, or recorded as already gone.
