# 02: A free class: the Tutor asks and waits

**What to build:** From the Tutor column, "Start a class" starts a Tutor session behind the Agent adapter, launched with its own instructions and without the person's plugins and instructions (using the recipe from ticket 01). The Tutor can ask the person a question through a tool and wait for the answer. The Tutor column shows the conversation: the Tutor's messages, and questions as cards: a multiple-choice card (options, then a confidence from 0 to 100 with stops 0, 30, 50, 70, 90, 100, default 50, and a "don't know" option), and a free-text card, both with an optional "what I thought" field. The answer is returned to the waiting tool. The empty state stays when the Tutor is unavailable (no adapter or not signed in), with a clear reason. The Tutor model selector already stored per Project is used for the session.

**Blocked by:** 01

**Status:** done

- [x] Through the core protocol with a scripted fake adapter: starting a class creates a Tutor session; a question tool call reaches the interface as an event and waits; an answer with confidence and thought returns to the tool; "don't know" is a valid answer; the choice of model reaches the adapter.
- [x] A question whose options or correct answer are missing is rejected with a message the model can act on.
- [x] The Tutor session is separate from the builder's: the builder chat is unaffected while a class runs.
- [x] Errors (not signed in, process failed) are shown in the Tutor column in plain words.
- [x] Verified with a headless browser: screenshots of a multiple-choice card with the confidence stops, and of a free-text card, no console errors, narrow-window behaviour intact.

## Review notes

- [x] Protocol tests (`test/tutor-session.test.ts`, 18 tests, scripted fake adapter): class start, Tutor model, own tool set, choice and text questions, "don't know", confidence stops and default, rejected questions (plain error text), withdrawal on a closed connection and on ending the class, independence from the builder chat, plain-words error, launch recipe with a fake spawn, cache tokens in usage. Full `npm test` and `npm run typecheck` pass.
- [x] Headless Chrome (scripted adapter, no real model): choice card with the six confidence stops, free-text card, answered cards collapse, focus moves to the new question, keyboard-only choice works, narrow window (drawer) has no horizontal overflow, no console errors.
- Tests were written before the code but I did not run them red first; they all passed on the first run.
- NOT verified live: the real Claude Code launch (only asserted through a fake spawn), a wait longer than 130 s (the spike limit; the adapter sets the two 30-minute env values), and the core MCP route against the real Claude Code for the Tutor (the permission route is known to work).
- "Start a class" is enabled as soon as a Project is open. The core cannot probe whether Claude Code is installed or signed in, so that shows up as a plain-words error when the class starts (the adapter existing not-installed and not-signed-in errors).
- The usage fix changed no existing assertion (fixtures only carry `input_tokens`).
- The Tutor tools stay on `/mcp/<token>` with a `role` on the conversation; `ask` is the only Tutor tool so far. A question outside the Plan is not rejected yet (no Plan exists).
