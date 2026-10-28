# 05: Text that does not depend on the project's language

**What to build:** Text the person reads says "Python" only where the fact is about Python (for example that a call such as `getattr` cannot be traced). Everything else says "project", "code" or "function": the placeholder and label of the field where a project path is typed, the empty state of the home screen, the Components and Algorithms legends, and the Playback panel (its field hints, its "own interpreter" option and its warnings). aidea is meant to work on projects in many languages, and today only Python is analysed; the text should not claim more or less than that. Where a message must say that only Python projects are supported now, it says so once, in one place, as a limitation and not as the definition of the product.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The project path field, the home empty state, the legends and the Playback panel contain no "Python" unless the sentence is about a Python-specific fact.
- [ ] Where the limitation is stated, it is one sentence in one place, worded as "for now".
- [ ] A test reads the interface text and fails if "Python" appears outside a short list of allowed exceptions, naming the file and the line.
- [ ] No behaviour changes: Playback and the analysis work exactly as before.
- [ ] Verified with a headless browser: screenshots of the home screen and of two legends; no console errors.
