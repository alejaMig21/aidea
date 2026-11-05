# 05: The Tutor builds the three layers of a project the person studies

**What to build:** For a Project marked as someone else's, the Tutor does not ask the person about requirements or business. It prepares the three layers from the fingerprint, a few chosen files (entry points, most-called modules, most-changed files, tests), the git history and the project's own documents, in passes (Architecture, then Requirements per surface, then Business, then a pass that looks for evidence against each claim), and teaches them: it explains each as a Proposal with its evidence and status (ticket 03), and nothing is written to a layer until the person accepts it (the Tutor has no autonomy over the Project). Business items state only what the code or the documents show, and say unknown where they do not; none is a hypothesis about purpose. It asks one thing: the person's learning goal, which decides what it builds in detail. These layers are study notes: they are not a Contract for the Builder and raise no Differences.

**Blocked by:** layer-inference 02, layer-inference 03, layer-inference 04, layer-inference 07, tutor-rewrite 04.

**Status:** ready-for-agent

- [ ] On a fixture Project of someone else, a scripted class prepares the three layers as explained Proposals and asks no question about intent; it asks for the learning goal once.
- [ ] No Proposal lacks evidence; Business items without support are marked unknown; no layer changes before the person accepts.
- [ ] The layers of a studied Project are marked as study notes and the Builder's Contract ignores them.
- [ ] A pass that finds counter-evidence withdraws or lowers the claim (a fixture proves it).
- [ ] Verified live with the real Tutor on a documented project with its documents hidden.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.
