# 02: aidea understands its own repository

**What to build:** The person wants a build of aidea to be able to open the aidea repository itself and show it in its layers. The core is TypeScript and the interface is plain JavaScript, so this needs the TypeScript and JavaScript language adapter (ticket 03 of language-adapters). When it exists, open this repository in the real app, look at the layers it can draw (Components for the core and the interface), and report what is useful and what is not, with tickets for the gaps.

**Blocked by:** language-adapters 03.

**Status:** ready-for-agent

- [ ] Opening the aidea repository shows its modules, classes and functions on the Components layer, with the imports between files.
- [ ] A written report (in this ticket) says what is readable, what is too big or too noisy, and what a person learning from this repository would still miss; each gap that matters becomes a ticket.
- [ ] Verified in the real app on the main screen; no file of the repository changes.
