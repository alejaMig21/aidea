# 09: Switching the Python plugin off or on leaves the old picture until Refresh

**What to build:** Found in the live pass of 2026-11-06 (Chromium, stand-in agents, commit `a68fdfe`). With a Python project open, Plugins > Python > "Switch off" says "Python is switched off." but, after the window closes, the Canvas still draws the old Nodes and the bar still says "Analysed: Python, 2 files." Only "Refresh" shows "Not analysed yet: Python, 2 files." and the plain statement that no plugin reads Python. "Switch on" behaves the same way the other way round. Switching a language plugin on or off must redraw the Project at once, as the person expects after a switch.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent (reproduce first: it was seen once, in a live pass, not yet in a test)

- [ ] A test that fails today: open a Python project, switch the plugin off through the core, and the next drawing (without a Refresh) says nothing reads Python; switching it on draws the Nodes again.
- [ ] Live: the same steps in the page, no Refresh needed.

Source: live pass 2026-11-06, ticket language-plugins 02.
