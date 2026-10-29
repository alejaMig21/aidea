# 04: Opening a big project says it is working

**What to build:** Opening hubstaff-automation takes 16 to 20 seconds (most of it the relationship analysis) and nothing on the screen says anything is happening. While a project is being opened, show one plain line ("Reading the project...") near the project name, and show the failure in words if it fails or takes longer than a minute. Where the analysis can be made faster at low cost, do it, and record how long it takes before and after.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] While `POST /projects` is running the interface shows the line, and removes it when the project is drawn; opening a second project while the first is still loading shows the second.
- [x] A failure (bad path, analysis error, timeout) shows a plain sentence with what to try, not an empty screen.
- [x] Times of opening Telegram and hubstaff-automation are recorded before and after in this ticket, and any speed-up is covered by a test that its result is identical.
- [x] Verified live on the main screen at two window sizes; the line uses the shared scale.

**Timings** (analysis alone, `analyze.py`, read-only on both projects): Telegram 5.3 s before, 4.8 s after; hubstaff-automation 14.3 s before, 12.0 s after. The one change: `json.dumps` (C encoder) instead of `json.dump` (streams through the slow Python encoder); output is byte-identical (checked with `cmp` on both projects and by `test/analysis-identical.test.ts`). Opening in the browser (POST, analysis, drawing): Telegram about 4 s, hubstaff-automation about 11 s on an idle machine (up to 8 s and 21 s when the machine was busy). The rest of the analysis time is the walks over the syntax trees in `relations.py` and `playback.py`; speeding those without changing the order of relationships is left out.

The failure line sits above the Components note (`#error` moved up) because the note covered it.
