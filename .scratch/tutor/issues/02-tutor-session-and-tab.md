# 02: A free class: the Tutor asks and waits

**What to build:** From the Tutor column, "Start a class" starts a Tutor session behind the Agent adapter, launched with its own instructions and without the person's plugins and instructions (using the recipe from ticket 01). The Tutor can ask the person a question through a tool and wait for the answer. The Tutor column shows the conversation: the Tutor's messages, and questions as cards: a multiple-choice card (options, then a confidence from 0 to 100 with stops 0, 30, 50, 70, 90, 100, default 50, and a "don't know" option), and a free-text card, both with an optional "what I thought" field. The answer is returned to the waiting tool. The empty state stays when the Tutor is unavailable (no adapter or not signed in), with a clear reason. The Tutor model selector already stored per Project is used for the session.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Through the core protocol with a scripted fake adapter: starting a class creates a Tutor session; a question tool call reaches the interface as an event and waits; an answer with confidence and thought returns to the tool; "don't know" is a valid answer; the choice of model reaches the adapter.
- [ ] A question whose options or correct answer are missing is rejected with a message the model can act on.
- [ ] The Tutor session is separate from the builder's: the builder chat is unaffected while a class runs.
- [ ] Errors (not signed in, process failed) are shown in the Tutor column in plain words.
- [ ] Verified with a headless browser: screenshots of a multiple-choice card with the confidence stops, and of a free-text card, no console errors, narrow-window behaviour intact.
