# 03: A lesson: how to ask for a plugin in Creator Mode

**What to build:** The first use of tickets 01 and 02: the person says what they want a plugin to do and the Tutor teaches, step by step, what a Builder needs to build it well: the plugin API, the template, the lesson and the teaching surface a plugin needs. The person ends with an Assignment a Builder can build from, and knows why each part is there.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser; the real Tutor and Builder were not run)

- [x] A scripted class takes a plain wish for a plugin and ends with a request the person wrote themselves that names the template, the lesson and the teaching surface.
- [x] A Builder given that Assignment (a fake agent) writes a plugin that passes the scan and installs.
- Not done here: verified live with the real Tutor and Builder (quota).

Source: `.scratch/roles-and-contract/spec.md`.

## What was built (2026-11-05)

- `guide.ts`: a new part "Asking for a plugin" after "Asking the Builder well": say what the plugin should do and what the person using it should see, and ask the builder for three things: read the plugin guide and copy the template, write the lesson, and (if the plugin has state of its own) write its teaching surface; the builder proposes and never installs, and the person reads the scan under "Plugins". The guide class message asks the person to write the request first (a text question) and the Tutor names which of the three things it leaves out.
- Tests (`test/guide-asking.test.ts`, now 5): the part and its place; and a fake Builder that copies `docs/plugin-template`, changes only the id, proposes it, gets a scan with no blocking finding and installs it (status `applied`, the plugin active): the request's three things are exactly what the template, the skill and `propose_plugin` already require.
- Live (main monitor, the person's browser): the quick tour has 12 steps and "Step 5 of 12: Asking for a plugin" follows "Asking the Builder well"; no page errors. The real Tutor and Builder were not run (quota).
- Note: the first box said the class ends with an Assignment; since ADR 0010 there is no Assignment card: the person's request is their own message in the Builder's chat.
