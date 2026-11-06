# 03: Every claim in a Proposal carries evidence, and the core checks it

**What to build:** A Proposal that the Tutor makes to add or change a Node on an authored layer can carry `evidence`: a list of files and line ranges, and a status for the claim: observed, inferred or unknown. The core checks that each cited file exists and that the cited lines exist; a Proposal with a citation that does not hold is refused with the citation named. The status shows on the Node and in the legend. Evidence is not required for Nodes the person writes themselves. The Builder makes no Proposals on the layers (roles-and-contract 11), so this is the Tutor's alone; the check sits in the one place every Proposal goes through.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A Proposal with evidence that exists is accepted and the evidence is kept on the Node.
- [ ] A citation to a missing file or to lines beyond the end of the file is refused in plain words.
- [ ] A claim marked unknown may carry no evidence and must say why.
- [ ] The Node shows its status in words as well as by look; the legend check passes.
- [ ] Core API and page tests pass.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.
