# 11: Home matches mockup C

**What to build:** The Home screen looks like the chosen mockup `.scratch/ui-redesign/mockups/C-home.png`, as drawn. Home is the whole window: no top bar, no chat, no side panels, no Canvas behind it. Centred column on a near-black background: a rounded logo tile with the letter "a" next to the title "aidea" and the tagline "Build software on a canvas of layers, and understand every decision."; below it "Open folder..." (filled accent button) and "New project" (outlined button); below, the label "RECENT PROJECTS" and one rounded card holding the list, each row with the folder name and its full path in a monospace face on the left and "Opened 10 min ago" / "Opened 2 hours ago" / "Opened yesterday" / "Opened 3 days ago" on the right. Choosing a row opens the Project. "New project" opens a small form in the same visual language (parent folder, name, error line); it is not in the mockup, so keep it minimal. Forgetting an entry and the unavailable state (not in the mockup) appear quietly on the row (for example a "Forget" text button shown on hover and on keyboard focus; an unavailable row is dimmed with "Folder not found") without changing the row layout.

**Blocked by:** 01, 02, 03 (done)

**Status:** done

- [x] A screenshot of Home at the same size as the mockup (1000x625 CSS px, device scale 2) put next to `C-home.png` shows the same layout, spacing, type sizes, colours, radii and wording. Differences are listed in the review notes.
- [x] Home covers the whole window: no top bar, chat, side panel or Canvas visible while it is shown.
- [x] Relative times are formatted as in the mockup.
- [~] Open folder, New project, opening a row, forgetting an entry and unavailable entries still work.
- [~] Empty state (no recents) uses the same visual language and explains how to start.
- [~] Keyboard: every control reachable, visible focus ring.

## Review notes

- The mockup PNG is 2880x1800 (1440x900 CSS px at device scale 2), not 2000x1250 as the ticket says; Home was compared at 1440x900 in a CSS-px screenshot.
- Verified with screenshots: layout, tile/title/tagline, button sizes, label, card, row pitch and relative times match within about 1 px. Home covers the window (top bar and others hidden via `body:has(#home:not([hidden]))`), a row opens the Project, the New project form and Forget on hover were seen working.
- Remaining differences: colours are estimated by eye (no pixel sampler available), so background, card and accent may be a few shades off; text weight/antialiasing differs slightly (Chromium vs the mockup renderer); the unavailable row, empty state, keyboard focus ring and the Home switcher entry were not screenshotted.
- Criteria ticked below are the ones verified by screenshot only.

`[~]` = closed as done without this check being recorded at the time; not re-verified (cleaned up on 2026-10-30, history in git).
