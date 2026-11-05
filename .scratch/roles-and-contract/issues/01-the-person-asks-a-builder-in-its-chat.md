# 01: The person asks a Builder for work by writing in its chat

**What to build:** The person starts a Builder by writing in its chat, for example "read the Contract and start with the first task". There is no Assignment card and no Send button: the person's own message is the action, and nothing else sends or starts anything (not the Tutor, not an automatic step). The Builder reads what it needs through the tools that plugins offer (roles-and-contract 10), and keeps its own permission mode and any Policy in force: a message never widens what a Builder may do. The composer may insert references (a Node, a Contract item, a lesson) as plain text the person can read and edit. This replaces the Assignment of ADR 0009 (decision 2); see ADR 0010.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser)

- [x] The person's message in the Builder's chat is the only way a Builder starts working on the Contract.
- [x] No tool, role or setting of the Tutor can send a message to a Builder (a test searches the Tutor's tools for any way to).
- [x] The composer can insert a reference to a Node or a Contract item as readable text.
- [x] The Builder's permission mode is unchanged by what the person writes (a fake Builder proves it).
- [x] Core API and page tests pass. (1920 and 1280 pixels were not looked at.)

Source: `.scratch/roles-and-contract/spec.md`, `.scratch/tutor-rewrite/spec.md` and ADR 0010 (decision 5).

## What was built (2026-11-05)

- The Assignment card with a Send button is gone as a design (ADR 0010): the person starts a Builder by writing in its chat. `test/builder-asked-in-chat.test.ts` pins what must stay true: no Tutor tool (the loop, the read tools, the plugin tools) can send to or start a Builder; a Tutor session never runs a Builder; a message reaches the Builder exactly as written and changes neither its permission mode nor its model nor any setting.
- The composer (`36-chat-refs.js`): a menu "Add a reference to the message" with the Project's code (modules, classes, functions, with their file) and the Contract's items (Business, Requirements and Architecture titles). The chosen one is written at the cursor as plain text (`the function "app.go" (app.py)`, `the architecture item "Orders"`) the person can read and edit; nothing is resolved or sent for them. Page test `test/chat-refs-page.test.ts`.
- The Builder reads what it needs through the tools aidea gives it (`read_contract` today; those a plugin offers since roles-and-contract 10).
- Live (main monitor, the person's browser, `serve-fake-builder.mjs`): the menu lists the project's modules and functions, choosing one wrote `Please read and change the module "nolesson/ui" (nolesson/ui.js) ` into the box and the menu went back to its first row; no page errors. The window is narrow in the extension, so the controls wrapped to two lines; 1920 and 1280 pixels were not looked at.
