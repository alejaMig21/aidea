# 06: Several files open as tabs in the Code panel

**What to build:** The Code panel holds several open files as tabs, with a refresh, and keeps "Open in my editor". The person can move between files and go back to where they were.

**Blocked by:** 04 (Code panel).

**Status:** ready-for-agent

- [ ] Opening a second file adds a tab; closing a tab shows the previous one.
- [ ] Each tab remembers the lines highlighted and the scroll position.
- [ ] Refresh updates the shown tab from disk; a file that was deleted is shown as gone, not as an error page.
- [ ] "Open in my editor" works from the Code panel with the existing editor settings.
- [ ] Verified live.
