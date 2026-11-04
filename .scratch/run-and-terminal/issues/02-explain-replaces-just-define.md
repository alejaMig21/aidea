# 02: "Explain" replaces "Just define" in the whole app

**What to build:** When the person selects text anywhere in aidea, the small control shows "Explain" (a brief explanation from the Tutor) where it used to show "Just define", and keeps "Enter the Tutor" for a full class. The same word is used in the guide and in GLOSSARY.md. The text of the control keeps traveling only as data. See `.scratch/run-and-terminal/spec.md` (story 48).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] The control shows "Explain" and "Enter the Tutor" for selected text in every Panel where it appeared before.
- [x] No visible text, test, guide part or glossary entry still says "Just define".
- [x] Existing behaviour is unchanged: the same limit, the same data-only travel, the same result of each button.
- [x] Page tests for the control pass with the new word.
- [ ] Verified live on the second monitor.
