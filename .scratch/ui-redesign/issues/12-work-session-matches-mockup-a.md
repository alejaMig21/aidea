# 12: Work session matches mockup A (with the layer tab look of mockup B)

**What to build:** The work session looks like `.scratch/ui-redesign/mockups/A-session-top-bar-switcher.png`, as drawn, except that the Layer tabs take the look of mockup `B-sidebar-both-columns.png` (the person's words: "A tal cual y B parcialmente": only B's layer selector). The old left "Projects" sidebar disappears: its job lives in the Project switcher.

What the mockup A shows, to reproduce:
- **Top bar:** logo tile "a" and "aidea"; a Project switcher button ("Project" in muted text, the Project name in bold, a caret); on the right two square icon buttons that fold the chat and the right slot. Opening the switcher shows a rounded popover with the label "CURRENT" (the open Project with a teal dot, name, full path in monospace, highlighted row), the label "RECENT" (name, path in monospace, relative time on the right: "2 h ago", "Yesterday", "3 days ago"), a divider and "Open folder..." in the accent colour. "Home" stays reachable (place it unobtrusively in the popover, below Open folder...).
- **Three rounded cards** on a near-black background with small gaps: the chat on the left with the header "Builder", the Canvas in the centre, the right slot on the right. Chat: user bubble right-aligned, tool lines in monospace, Proposal boxes with a dashed accent outline, the assistant text, and at the bottom an input card ("Ask the builder" label, placeholder "Describe what to build or change", a Send button in the accent colour). No model chip (the model selector is out of scope, ticket 17).
- **Canvas card:** dotted-grid background; the Layer tabs float in a rounded container at the top of the card; nodes are rounded cards with a small coloured dot, a title and a monospace subtitle; Proposal nodes have a dashed accent outline and a "PROPOSAL" label; a zoom control at the bottom right (minus, "100%", plus, "Fit") that drives the existing pan and zoom.
- **Layer tabs (look from B):** a rounded container; Business, Requirements, Architecture in amber text; Components, Algorithms, Code in teal text; the selected tab is a filled darker rounded pill with light text; unselected tabs have no fill. Proposal counters on the tab (from ticket 04) stay, drawn as a small badge.
- **Right slot card:** tabs "Tutor" and "Algorithms" with an underline on the selected one (the Algorithms tab still appears only while an Algorithm is open, per the spec). The Tutor empty state is centred: a "?" icon tile, the title "The Tutor is not available yet", the text "When it is, it will explain why each decision was made and ask you questions about your project.", and a disabled "Start a class" button.
- The Algorithm column's contents (test-data form, own-Python switch with its warning, Playback) take the styling of the right column in mockup B (section labels in small caps such as "TEST DATA" and "PLAYBACK", filled inputs, "Use example" outlined button and an accent primary button, a monospace values box).
- Colours, radii, type sizes and spacing are taken from the mockup images (dark theme, periwinkle accent, amber for authored, teal for derived).

**Blocked by:** 04, 05, 08, 09 (done)

**Status:** ready-for-agent

- [x] Screenshots of the work session at the mockup's size (1000x625 CSS px, device scale 2) put next to `A-...png` (and, for the tabs and the Algorithm column, `B-...png`) show the same layout, spacing, type sizes, colours, radii and wording. Differences are listed in the review notes.
- [x] The popover shows CURRENT and RECENT with relative times and "Open folder...", and switching Project from it works.
- [x] The old left Projects sidebar is gone and nothing that worked through it is lost (opening by typed path remains available when the desktop shell is absent, inside the switcher's "Open folder...").
- [ ] Resizing, folding, persistence, proposals, permission cards, chat and Playback still work in the new look.
- [x] Zoom control drives the Canvas.
- [ ] Keyboard: every control reachable, visible focus ring, contrast at least 4.5:1 for text.

## Review notes

Compared at 1440x900 CSS px (the mockups are 2880x1800 at scale 2, so CSS px = displayed px x 0.72), with Playwright screenshots of `studio` (Architecture, popover open), `playback` (Components, and an open Algorithm after recording a run) and a 1000x625 and 1500x850 window. Colours were sampled from the PNGs; font sizes were matched by measuring text widths (names and tabs 13px, mono paths 11px, labels 11px caps).

Verified by screenshot or by script: top bar, popover (CURRENT, RECENT with "2 h ago" / "Yesterday" / "3 days ago", Open folder..., Home, typed path field), three cards, chat header and input card, Layer tabs with amber/teal text and a filled selected pill, authored node cards, Proposal nodes (injected through the page, since no builder runs here) with PROPOSAL label and counter badge, Tutor empty state, zoom control (buttons and Fit), Algorithm column with Playback, folding with persistence, Home entry and Home's "Open folder" opening the typed path field, no console errors.

Not ticked, not verified: "Resizing, folding, persistence, proposals, permission cards, chat and Playback still work" (folding, Playback and the Proposal drawing were exercised; dragging the separators, a real chat round trip and permission cards were not; their markup was restyled only through CSS), and "Keyboard / contrast" (focus ring rule is unchanged, tokens were not re-measured; the muted text #9aa3b2 on #151921 is about 6.9:1 by calculation, disabled Layer tabs and "Start a class" are lower by design).

Remaining visible differences from the mockups:
- Authored layers have no connectors between nodes (the mockup draws a line Web app to Quote database and a dashed one to the Proposal): the core lays out cards without edges. Node cards are the core's 240x64 rects, so they read slightly larger than in the mockup (200x58).
- The dot grid is a CSS background and does not pan or zoom with the Canvas.
- The chat input card has no model chip row (out of scope, ticket 17), so it is shorter than in mockup A.
- The Tutor "Preview of a future question" panel of mockup B is not built (not part of this ticket).
- The Algorithm column keeps the existing "Record a run" label (mockup: "Play"), the checkbox and the safety warning, and labels fields with the parameter name; its header repeats "Algorithm" under the tab bar, as B does.
- Popover has an extra "Home" row; long paths are cut with an ellipsis instead of overflowing.
- Below roughly 1000px wide the Canvas hits its 320px minimum and the Layer tabs scroll.
- On Home the top bar and the three cards still show; that screen is restyled by ticket 11.
