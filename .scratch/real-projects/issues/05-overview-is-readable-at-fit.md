# 05: The overview of a big project is readable when it fits the screen

**What to build:** The overview of the Components layer (ticket 03) fits Telegram and hubstaff-automation on one screen, but at the Fit zoom (15% to 32%) the folder names and module names are too small to read, so the person must zoom in before knowing what anything is. Make the folder labels and the module names stay readable at Fit: the labels of folders keep a minimum on-screen size whatever the zoom (the boxes shrink, the folder names do not), and module names appear only when the zoom makes them readable, so nothing is drawn as an unreadable shape. The shared scale of sizes (`docs/agents/ui-style.md`) sets the minimum size.

**Blocked by:** 03 (done).

**Status:** ready-for-agent

- [x] At Fit, on Telegram at 1920 and 1280 pixels wide, every folder label is at least the smallest size of the shared scale on screen and does not overlap another label.
- [x] Module names that would be smaller than that size are not drawn; they appear when zoomed in enough, and hovering a module shows its name in any case.
- [x] The number of SVG elements stays under 5,000 and the overview still draws in under 3 seconds.
- [ ] A project with 40 modules or fewer draws exactly as before.
- [x] Verified live on the main screen at two window sizes, with a short written verdict.

**Verdict (live, headless Chrome):** Telegram at Fit, 1920 (32%) and 1280 (20%): 24 folder labels, all 13px on screen, no overlap, longest paths cut with an ellipsis and the full name in the tooltip; module names and counts appear from 85% and 92% zoom. hubstaff-automation at 1280 (15%): readable but narrow one-module folders are cut to a few letters. 1,809 and 3,357 SVG elements; the overview draws in 0.2 s once the analysis answers. The 40-module-or-fewer box is not ticked: that path is untouched but was not compared against a baseline.
