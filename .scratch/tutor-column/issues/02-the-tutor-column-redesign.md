# 02: The Tutor column, redesigned

> Note (2026-11-04): Class mode, Direct mode and the decision classes were removed in commit 58d676d. Read what follows as history of how the Tutor was built, not as how it works now.


**What to build:** A live run of the app at full screen showed that the Tutor column is crowded and unclear: its top is the empty state of the time when the column held nothing (an icon, a big title) with settings piled under it, and the main action ("Start a class") is at the bottom and looks disabled; the Probe offer competes with it as the loudest button; Plan, Differences and Contract are long stacked cards; questions of two kinds look unlike each other; edges and alignments are mixed. The person and the assistant went through the design decision by decision (the decisions below are confirmed). The look follows the shared scale in `docs/agents/ui-style.md`: no size or colour that the rest of the app does not already use.

Decisions:

1. **Top of the column:** a topic field and one large "Start a class" button, same width, then one line of help. No icon, no big title.
2. **The Probe** is one secondary line under the button, tied to the layer on screen: "Architecture: not checked yet · Check what I know (3 to 5 questions)", and "checked · Redo" once measured. It is not a primary button.
3. **Builder settings:** Direct / Class move to the foot of the Builder column, next to the model and permission selects. The Tutor's own model select stays in the Tutor column with the label "Tutor model", in one compact row with the review-question checkbox.
4. **Sections:** Plan, Differences and Contract are folded by default, each with a one-line summary ("Plan · 4 of 9 covered", "Differences · 3", "Contract · 2 of 6"), opened with a click; what is open is remembered in the browser only; during a class they stay folded.
5. **Plan:** a numbered list in dependency order, each concept on one line with its tick when covered, the dependency as small grey text under it ("after 1 and 2"), and the progress summary on top.
6. **Questions:** "What I thought" is folded behind a link "Add what you thought" (the answer is still stored as Evidence); the prompt of every question, choice or text, has the same style; cards never touch the right edge of the column.
7. **Look:** only existing sizes and colours: what the person reads or answers at 13.5px in `--text` (like the chat), secondary text 12px in `--muted`, labels 11px uppercase; the start button no longer uses the hard-coded grey `#6f788a` that makes it look disabled. Left-aligned on one edge, one width, one margin.
8. **Width:** the default tracks give the Tutor more room (about Builder 380, Tutor 540, Canvas the rest), always resizable and remembered; a person who already resized keeps their sizes.

**Blocked by:** 01 (the person approves the mockup first).

**Status:** done (the live check with the real app on the second monitor is left to the lead)

- [x] The mockup (ticket 01) is approved and its changes, if any, are written under "Verdict" here.
- [x] The behaviour of every existing feature of the column still works as before: starting a class with or without a topic, the review question, the Probe (offer, skip, redo), probe/class cards with skip and "Don't know", the end/skip buttons, the Plan, Differences and Contract content, the layer class and decision class entries, selecting text, and narrow windows (drawers).
- [x] The Direct/Class setting still works from the Builder column and is remembered per Project; the review checkbox and Tutor model still work.
- [~] Verified with the real app at full screen on the second monitor: captures of the three columns side by side before and after, in the three states of the mockup; no console errors; the legend check and the language-neutral text test pass. (Done in headless Chrome at 1920x1080; the real Electron app on the second monitor is not done yet.)
- [x] `docs/agents/ui-style.md` is updated if any role of text is added to the scale.

## Verdict

The person approved the mockup as it is (ticket 01): branch `prototype/tutor-column`, commit `470a130`, file `src/ui/features/99-prototype-tutor-column.js` (read it with `git show prototype/tutor-column:src/ui/features/99-prototype-tutor-column.js`; its CSS and markup are the reference for sizes, spacing and structure, its stub data and wiring are not). No changes were asked.

## Review notes

- [x] Top of the column: topic field, one large "Start a class" button of the same width and one help line; the hard-coded `#6f788a` button style and the icon/title hero are gone (`src/ui/index.html`, `07-layout.js`, `50-tutor.js`). The Probe is one muted line under it with text links ("Architecture: not checked yet · Check what I know (3 to 5 questions) · Skip", "checked · Redo", "check skipped · Check what I know ..."), still tied to the layer on screen and still starting the real Probe (`51-probe.js`). The Known/partly/new counts of a finished check moved to the line's tooltip.
- [x] Settings: Direct / Class is a segmented "Builder works" control at the foot of the Builder column (`35-agent-options.js`), same `POST /agent-options {classMode}`; "Tutor model" (visible label) and "Start with a review question" are one compact row in the Tutor column.
- [x] Sections: new `48-tutor-sections.js` gives Plan, Differences and Contract one folded `<details>` with a one-line summary ("5 of 9 covered", "3" or "none", "2 of 6"); open or closed is kept in `localStorage` (`aidea.tutor-sections`, every access in try/catch); a class folds them and does not store that. The Plan is a numbered list in dependency order with a tick, "after 1 and 2" under each concept (the numbers of the list) and a progress bar.
- [x] Questions: one prompt style for choice, text, predict, review and probe (13.5px, 600, `--text`); "What I thought (optional)" waits behind the link "Add what you thought" and the answer still sends `thought`; cards share the column width and keep its 16px margin.
- [x] Width: default weights are Builder 380 and Tutor 540 (`layoutDefault` in `07-layout.js`); saved sizes still win, drag and drawers unchanged.
- [x] Checked with a headless script outside the repo (playwright-core, scripted Teacher and Prober through the core's MCP tools, 1920x1080, then 700px): 42 checks pass, among them one left edge and one width for field, button, probe line, settings row and sections; no horizontal overflow at rest, with sections open, in a class and at 700px; folded state kept after reload and the page works when `localStorage` throws; Class/Direct, review checkbox and Tutor model stored; Probe link starts the Probe, Redo and Skip work; "Add what you thought" sends the thought; start with and without a topic, "Don't know", layer class and decision class entries reach `/tutor/classes`; saved sizes win over the new defaults; the separator still drags. Typecheck clean, 403 tests, 402 pass, 1 skipped (legend check and language-neutral text test included).
- [x] Code-review (Standards: all sizes and colours in the scale, one label colour to document; Spec: a real gap in decision 8) fixed in a second commit: a size is saved as the person's own only after they drag a separator (folding a pane used to save all three numbers as if they were choices, so the new defaults never reached anyone who had used the app); a save from before that holds only the old defaults (340 and 320) counts as no choice. Also: a thrown request on Direct/Class or the review checkbox puts the stored choice back and a failed load shows no choice as pressed; a stored `null` for the folded sections cannot break the page; the Plan lists what a concept comes after in ascending order; the link style is one rule (`.tutor-link` and the Probe line); the phase label of a question card (11px, `--accent`) is a row of `docs/agents/ui-style.md`. Checked in headless Chrome (old save gets 413/590, fold and unfold do not freeze the widths, a dragged separator survives a reload) and with the 42-check script of the first commit.
- NOT done (left on purpose): the Probe line is still shown when the Tutor is unavailable (its link ends with "The Tutor is not available."); the Direct/Class control can now be changed during a class (it lives in the Builder column and does not depend on the Tutor's class); the folded sections stay folded when a class ends; the open or closed choice of a section is one choice for all Projects; the selected-text entry was not driven.

`[~]` = closed as done without this check being recorded at the time; not re-verified (cleaned up on 2026-10-30, history in git).
