# The Tutor teaches and has no autonomy; the Contract conditions the Builders through policies

**Agreed with the person in conversation (2026-11-05); to be confirmed when read.** It follows ADR 0008 (a small kernel, everything else a plugin) and the LearnHarness model for the Tutor (`.scratch/tutor/research/01-learnharness.md`).

## Decision

1. **The Tutor teaches and has no autonomy over the Project; the person has it.** Everything the Tutor wants to do it communicates or turns into a lesson; the person acts. It never sends anything to a Builder and never changes a layer or a plugin by itself: it makes Proposals that the person accepts.
2. **An Assignment is the way the person asks a Builder for work.** The person writes it; the Tutor teaches how and checks it; only the person's own action sends it. There is no automatic sending, not even optional.
3. **The Contract is the Plan Mode of aidea for a whole project.** The person approves it, Builders work inside it, a change after approval is a Proposal. It gains tasks with a status and an owner. It lasts and is shared, unlike the plan of one task, which each Builder makes in its own plan mode.
4. **The Contract is a plugin that ships with aidea.** With it off there is no Contract and no condition. With it on the condition is hard: what is not in the Contract is not developed (to be tuned after real use).
5. **Plugins can condition other plugins through policies.** A policy matches an action by its class and scope (for example, writes inside this Project), never by the type of plugin, and never names a Builder, so a Builder made with Creator Mode is held the same way and a plugin that writes essays outside any Project is not.
6. **"Hard" is as hard as aidea can honestly make it.** Where aidea mediates the action (a Builder driven through Claude Code asks aidea's permission tool for each write) it is prevented; where it does not, it is detected and reverted or flagged. The screen says which, and never promises a guarantee it cannot give.
7. **The Tutor learns each plugin through the plugin's teaching surface** (a lesson, a read-only view, named checks), not through knowledge of it written into the Tutor. The surface is required for plugins the Builder writes.
8. **The three authored layers can be inferred for any project, with evidence**: every claim cites files and lines and the core checks the citations; Business is never a hypothesis that could read as an accusation; for a project of someone else the Tutor asks only for the person's learning goal and the layers are study notes. The code graph is evidence and chooses what to read; it is never drawn.

## Consequences

- The Contract, the Differences and their sections leave the core and the Tutor's panel for a plugin (`.scratch/roles-and-contract`).
- Guard rules get a class and a scope for every action, and a detector for what is not mediated (`.scratch/plugin-policies`).
- Plugin lessons and teaching surfaces become part of what a plugin is (`.scratch/plugin-lessons`, `.scratch/plugin-teaching`).
- Inferring layers, studying other people's projects and the structural index follow `.scratch/layer-inference`.
- The glossary gains Assignment, Policy, Teaching surface, Fingerprint, Index provider and Project-kind plugin, and extends Tutor, Contract and Plan. The word brief stays reserved: the Contract is not a brief.
- Open: the exact list of action classes; how a studied project's layers are marked as study notes; Instances (several Builders and Tutors) and the migration of the agent adapter to a Provider plugin, which several of these depend on.

## When this changes

Revisit decision 4 if the hard condition proves too heavy in use (the person asked to tune it after trying it), and decision 6 if a way to mediate more actions appears.
