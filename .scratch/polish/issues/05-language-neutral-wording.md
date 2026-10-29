# 05: Text that does not depend on the project's language

**What to build:** Text the person reads says "Python" only where the fact is about Python (for example that a call such as `getattr` cannot be traced). Everything else says "project", "code" or "function": the placeholder and label of the field where a project path is typed, the empty state of the home screen, the Components and Algorithms legends, and the Playback panel (its field hints, its "own interpreter" option and its warnings). aidea is meant to work on projects in many languages, and today only Python is analysed; the text should not claim more or less than that. Where a message must say that only Python projects are supported now, it says so once, in one place, as a limitation and not as the definition of the product.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The project path field, the home empty state, the legends and the Playback panel contain no "Python" unless the sentence is about a Python-specific fact.
- [x] Where the limitation is stated, it is one sentence in one place, worded as "for now". (Nothing in the interface states it any more, so there is nothing to repeat.)
- [x] A test reads the interface text and fails if "Python" appears outside a short list of allowed exceptions, naming the file and the line.
- [x] No behaviour changes: Playback and the analysis work exactly as before.
- [x] Verified with a headless browser: screenshots of the home screen and of two legends; no console errors.

## Review notes

- [x] `test/language-neutral-text.test.ts` reads `src/ui/index.html` and `src/ui/features/*.js` (comment lines skipped) and fails with `file:line` for every whole-word "Python" outside its allowlist. Red first on today's text (10 lines listed), green after rewording (385 tests, 384 pass, 1 skipped; typecheck clean).
- [x] Reworded: path field placeholder and label ("Path to a project"), home empty state, Components legend (Package, Visibility, "built-in functions"), Playback hints ("a value, such as 3 or [1, 2]"), the option "Use the Project's own interpreter (.venv or venv)" and the warning "Interpreter used: ...". Element ids (`pb-own-python`) and request fields (`useProjectPython`) are untouched.
- [x] One allowed exception: the Components legend line on unresolved calls, because `getattr` and functions held in variables are Python facts.
- [x] Verified in headless Chrome: home screen, Components legend and Architecture legend screenshots, the only "Python" in the legends is the allowed line, no console errors.
- [x] Code-review: fixed the missing space in "Interpreter used: <name>"; ADR 0004 now describes where Python is still named. Left on purpose: the core error messages about the parser ("The file cannot be read as Python", "Python literal texts") and `playback.py`, which are outside the text the ticket lists.
- NOT done: the Algorithms legend and the Playback panel were checked by text and test only, not by screenshot (the Algorithms tab needs a selected function); core error messages ("The file cannot be read as Python", "Python literal texts") keep the word, they are about the parser and existing tests assert them, and the test does not scan `src/core`.
