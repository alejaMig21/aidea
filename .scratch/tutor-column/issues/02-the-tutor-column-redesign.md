# 02: The Tutor column, redesigned

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

**Status:** ready-for-agent

- [ ] The mockup (ticket 01) is approved and its changes, if any, are written under "Verdict" here.
- [ ] The behaviour of every existing feature of the column still works as before: starting a class with or without a topic, the review question, the Probe (offer, skip, redo), probe/class cards with skip and "Don't know", the end/skip buttons, the Plan, Differences and Contract content, the layer class and decision class entries, selecting text, and narrow windows (drawers).
- [ ] The Direct/Class setting still works from the Builder column and is remembered per Project; the review checkbox and Tutor model still work.
- [ ] Verified with the real app at full screen on the second monitor: captures of the three columns side by side before and after, in the three states of the mockup; no console errors; the legend check and the language-neutral text test pass.
- [ ] `docs/agents/ui-style.md` is updated if any role of text is added to the scale.

## Verdict

The person approved the mockup as it is (ticket 01): branch `prototype/tutor-column`, commit `470a130`, file `src/ui/features/99-prototype-tutor-column.js` (read it with `git show prototype/tutor-column:src/ui/features/99-prototype-tutor-column.js`; its CSS and markup are the reference for sizes, spacing and structure, its stub data and wiring are not). No changes were asked.
