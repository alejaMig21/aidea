# 11: Home matches mockup C

**What to build:** The Home screen looks like the chosen mockup `.scratch/ui-redesign/mockups/C-home.png`, as drawn. Home is the whole window: no top bar, no chat, no side panels, no Canvas behind it. Centred column on a near-black background: a rounded logo tile with the letter "a" next to the title "aidea" and the tagline "Build software on a canvas of layers, and understand every decision."; below it "Open folder..." (filled accent button) and "New project" (outlined button); below, the label "RECENT PROJECTS" and one rounded card holding the list, each row with the folder name and its full path in a monospace face on the left and "Opened 10 min ago" / "Opened 2 hours ago" / "Opened yesterday" / "Opened 3 days ago" on the right. Choosing a row opens the Project. "New project" opens a small form in the same visual language (parent folder, name, error line); it is not in the mockup, so keep it minimal. Forgetting an entry and the unavailable state (not in the mockup) appear quietly on the row (for example a "Forget" text button shown on hover and on keyboard focus; an unavailable row is dimmed with "Folder not found") without changing the row layout.

**Blocked by:** 01, 02, 03 (done)

**Status:** ready-for-agent

- [ ] A screenshot of Home at the same size as the mockup (1000x625 CSS px, device scale 2) put next to `C-home.png` shows the same layout, spacing, type sizes, colours, radii and wording. Differences are listed in the review notes.
- [ ] Home covers the whole window: no top bar, chat, side panel or Canvas visible while it is shown.
- [ ] Relative times are formatted as in the mockup.
- [ ] Open folder, New project, opening a row, forgetting an entry and unavailable entries still work.
- [ ] Empty state (no recents) uses the same visual language and explains how to start.
- [ ] Keyboard: every control reachable, visible focus ring.
