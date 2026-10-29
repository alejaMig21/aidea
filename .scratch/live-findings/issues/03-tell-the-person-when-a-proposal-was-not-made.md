# 03: The person is told when a Proposal could not be made

**What to build:** When the Tutor (or the builder) tries to make a Proposal that the core refuses, only the model hears it. In a live run a layer class on Requirements asked the person a question, and the Teacher then tried to propose the Node `save-cart`; a Proposal with that id was already waiting from an earlier class, so the core refused, the Teacher went on to the next question, and the person never saw a Proposal or any reason for it. When a Proposal made on the person's behalf is refused, the Tutor column (for the Tutor) and the chat (for the builder) show one plain line saying what was refused and why ("The Tutor tried to add "save-cart", but a proposal with that name is already waiting for you. Review it first."), with a button to open the waiting Proposal when there is one. Errors that are the model's mistake in the shape of its call (a missing field) stay between the model and the core.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Through the protocol: a Proposal refused because its id is already pending, or because the Node already exists, emits an event the interface can show, carrying the reason and the id of the waiting Proposal when there is one; the model still gets its error text.
- [ ] A refusal for a malformed call (wrong field, unknown layer) emits no such event.
- [ ] Both sources work: a Proposal from the Tutor's tools and one from the builder's tools.
- [ ] Verified with a headless browser: the line appears in the Tutor column after a refused Tutor Proposal, its button opens the waiting Proposal, and a refused builder Proposal shows its line in the chat; no console errors.
