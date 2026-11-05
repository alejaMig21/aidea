# 04: When no plugin reads a Project's language, aidea says so and offers a way forward

**What to build:** When the files of a Project are in a language that no enabled plugin claims, Components, Flow, Data and Playback say in plain words that no plugin reads that language and name the languages found. If a structural index exists for it (layer-inference 10) the Components layer is drawn from it, marked as approximate. The way forward is offered as a lesson, "how to ask for a plugin for R" (roles-and-contract 03): the Tutor teaches and the person writes the request and sends it to a Builder; aidea prepares and sends nothing for the person. The layers the person writes (Business, Requirements, Architecture) keep working. A Project with no analysable language at all is not an error.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser)

- [x] A fixture Project in a language with no plugin opens; its authored layers work; the derived layers show the message and the offer.
- [x] The offer starts the lesson on how to ask for a plugin; no Assignment is prepared or sent for the person, and nothing is installed without the usual quarantine and confirmation.
- Moved: with Python turned off a Python Project gets the same message (needs Python to be a plugin: language-plugins 02).
- [x] Page tests pass. (1280 pixels was not looked at.)

## What was built (2026-11-05)

- `languages.ts`: aidea now knows by name R, Rust, Go, Java, C#, C, C++, Ruby, PHP, Swift and Kotlin (`NAMED`): a Project with their files lists them as not analysed (with their files counted) instead of looking empty; a language plugin that claims the same id or extensions replaces the name (the names never block a plugin: tested). `languageOfFile` knows them too.
- The Components layer (`00-canvas.js`): when no analysed language is found it says "No plugin reads R, so aidea cannot draw this project's code yet. Business, Requirements and Architecture still work." and offers "Learn how to ask for a plugin for R": it starts the guide class with the person's question (the Tutor teaches "Asking for a plugin", roles-and-contract 03). The offer writes nothing in the Builder's chat, prepares and sends no request, installs nothing.
- Tests: `test/language-unread.test.ts` (3: detection, a Project in R opens with no nodes and no error, a plugin may claim the extensions) and the page test `test/language-offer-page.test.ts` (2).
- Live (main monitor, the person's browser, `serve-r-project.mjs`): the project in R shows `Not analysed yet: R, 1 file.`, the message and the button; pressing it opened the class with "The person asks: aidea cannot read the R code of my project yet. Teach me how to ask for a plugin that reads R."; the chat box stayed empty; no page errors.
- Not done: "with Python turned off" (Python is not a plugin yet: language-plugins 02) and the structural index (layer-inference 10) when it exists; Flow, Data and Playback are reached from a function of Components, so with no nodes they cannot be opened and need no message of their own; the window at 1280 pixels was not looked at.
