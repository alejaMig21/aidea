# 04: Opening a big project says it is working

**What to build:** Opening hubstaff-automation takes 16 to 20 seconds (most of it the relationship analysis) and nothing on the screen says anything is happening. While a project is being opened, show one plain line ("Reading the project...") near the project name, and show the failure in words if it fails or takes longer than a minute. Where the analysis can be made faster at low cost, do it, and record how long it takes before and after.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] While `POST /projects` is running the interface shows the line, and removes it when the project is drawn; opening a second project while the first is still loading shows the second.
- [ ] A failure (bad path, analysis error, timeout) shows a plain sentence with what to try, not an empty screen.
- [ ] Times of opening Telegram and hubstaff-automation are recorded before and after in this ticket, and any speed-up is covered by a test that its result is identical.
- [ ] Verified live on the main screen at two window sizes; the line uses the shared scale.
