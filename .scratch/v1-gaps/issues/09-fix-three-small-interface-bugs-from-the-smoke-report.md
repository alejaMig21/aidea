# 09: Three small interface bugs from the Electron smoke report

**What to build:** `open()` shadows `window.open` in `src/ui/features/00-canvas.js`; the layer bar is clipped at 1280 px; the validation block overlaps the Requirements header. Re-check each first: some may already be gone.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Each defect is either reproduced and fixed with a screenshot at 1920 and 1280, or recorded as already gone.

Re-check (headless Chrome, 1920 and 1280, a project with business and requirements layers, one requirement invalid):

- `open()` shadowing `window.open`: already gone. The function is `openProject` in `00-canvas.js`, every caller uses that name, and `String(window.open)` is native in the page.
- Validation block over the Requirements header: already gone. Problems moved into the Problems badge and popover (commit d9c88af); nothing is drawn over the Canvas.
- Layer bar clipped at 1280: reproduced. `body.has-problems #layers` reserved 190px for a Problems button that sits on the row below, so the bar was 394px wide for 618px of tabs ("Com" cut). Removed that rule: the bar is now 516px (ends beside the `?` button). At 1280 with both side columns open the six tabs still need 618px, so the last tab scrolls horizontally (nothing is lost). At 1920 the bar fits whole.
