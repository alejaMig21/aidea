# 01: Spike: can Claude Code host the Tutor roles?

**What to build:** A short written report, saved under `.scratch/tutor/research/`, that replaces assumptions with measured facts. No product code is delivered. Using the person's installed Claude Code in non-interactive mode with tiny prompts and the cheapest model, find out and record: (a) the exact options that give a session its own instructions, no personal plugins, skills, hooks, memory or user instructions, and no built-in tools beyond what aidea allows, while keeping the subscription login (the builder adapter already launches Claude Code: read it first); (b) how a session is given an MCP tool server of its own and how a tool call that waits a long time for a person's answer behaves (timeouts, what the builder adapter already learned about waiting); (c) whether several sessions with different instructions can run one after another or at the same time on one machine; (d) the shape and stability of the streaming events and the cost field (`total_cost_usd`, token usage), and a measured cost of a minimal Teacher-like turn, an Extractor-like call over about 500 words and an Auditor-like call; (e) how a session is resumed and what survives; (f) which model aliases work and what each costs for the same small task. Also try the three Tutor-critical behaviours with a fake MCP tool server written for the experiment: a question tool that blocks until answered, a tool whose arguments are rejected with an error the model then corrects, and an instruction that ends the turn after a question is posed. Limits: at most 20 real model calls in total, each with a prompt under 300 words, nothing run that changes the person's projects, no credentials read.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The report lists, for each of (a) to (f), what was tried, the exact command-line options or settings used, the observed result and a confidence note.
- [ ] The report gives a recommended launch recipe per role (Prober, Teacher, Extractor, Auditor): options, tools, model alias, and the expected cost of a typical class.
- [ ] The three Tutor-critical behaviours are each reported as working, working with caveats, or not working.
- [ ] Anything that blocks the spec's design is listed with an alternative.
- [ ] The total number of real model calls used is stated and is at most 20.
