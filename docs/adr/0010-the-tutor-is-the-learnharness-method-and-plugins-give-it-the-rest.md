# The Tutor is the LearnHarness method, and plugins give it everything else

**Agreed with the person in conversation (2026-11-05); to be confirmed when read.** It builds on ADR 0008 (a small kernel, everything else a plugin) and ADR 0009 (the Tutor teaches and has no autonomy). The full design is `.scratch/tutor-rewrite/spec.md`.

## Decision

1. **The Tutor is rewritten.** It works as LearnHarness does: one continuous conversation that measures, plans, teaches one fact per step (predict, explain, check with confidence, repair) and, in separate sessions, practises. The person needs an Open Project and may ask anything.
2. **The Tutor knows no part of aidea by name.** It learns each plugin through the plugin's teaching surface (lesson, read-only view, named checks). Helping to form the architecture or a Contract is the Tutor using the plugins that own them.
3. **Practice** can be asked for by the person or by the Tutor. A practical problem is a manual task in a plugin, verified by its checks.
4. **Builders get tools from plugins.** A plugin can offer tools to the agents; the Contract plugin offers the Builders a way to read the Contract. The Tutor and the Builders never talk to each other.
5. **The person starts a Builder by writing in its chat.** This replaces the Assignment card with a Send button of ADR 0009 (decision 2): the principle is the same (nothing but the person's own action starts a Builder, and the Tutor never does), the mechanism is simpler.
6. **The Learner graph is reset in the first build.**

## Consequences

- The classes by entry point, the per-layer Probe and the sections for the Contract and the Differences leave the Tutor.
- A rule, checked mechanically: nothing that is part of aidea ships without its lesson and surface.
- `.scratch/tutor-rewrite` holds the tickets; several earlier tickets were rewritten or absorbed (see the backlog).

## When this changes

Revisit decision 4 if a Builder cannot be made to read what a plugin offers, and decision 1 if the continuous conversation proves too long to follow in use.
