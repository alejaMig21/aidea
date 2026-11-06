# 03: Every claim in a Proposal carries evidence, and the core checks it

**What to build:** A Proposal that the Tutor makes to add or change a Node on an authored layer can carry `evidence`: a list of files and line ranges, and a status for the claim: observed, inferred or unknown. The core checks that each cited file exists and that the cited lines exist; a Proposal with a citation that does not hold is refused with the citation named. The status shows on the Node and in the legend. Evidence is not required for Nodes the person writes themselves. The Builder makes no Proposals on the layers (roles-and-contract 11), so this is the Tutor's alone; the check sits in the one place every Proposal goes through.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-06 (Tutor Proposals carry evidence and the core checks it)

- [x] A Proposal with evidence that exists is accepted and the evidence is kept on the Node.
- [x] A citation to a missing file or to lines beyond the end of the file is refused in plain words.
- [x] A claim marked unknown may carry no evidence and must say why.
- [x] The Node shows its status in words as well as by look; the legend check passes.
- [x] Core API and page tests pass.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.

## What was built (2026-11-06)

A Node may carry `evidence`: `{ status: "observed" | "inferred" | "unknown", cites?: [{ file, from, to }], why? }`. It is optional, so what the person writes needs none.

- **Shape** (`evidenceProblem` in `authored.ts`, run by `nodeProblem`, so it also guards layer files edited by hand): observed and inferred need at least one citation (at most 20); unknown needs `why` and may have none; lines are integers with `1 <= from <= to`. A Node with a bad evidence is dropped with the field named, like any bad field.
- **Existence** (`citationProblem` in `proposals.ts`, run by `propose()` for an add and for an update that changes the evidence): the file is inside the Project (absolute paths, `..` and links that leave it are refused), exists, is a file, is at most 5 MB, and has the cited lines. The refusal names the citation, for example `The citation "src/app.py" lines 10-40 goes past the end of the file: it has 12 lines`.
- **Kept:** accepting a Proposal writes the whole Node, so the evidence stays (tested through `apply` and `loadAuthored`).
- **Seen:** the Node's details show an Evidence section in words (status, each citation, the reason); the Proposal card writes it out instead of JSON; inferred and unknown boxes get a mark (`54-evidence.js`, dotted and dash-dot outline in the muted tone, never over a Difference's outline), observed has none; the legend of the three layers explains both marks. The tone is `muted` because the legend check only accepts tones its colour list names.
- **The Tutor is told** about `evidence` in `NODE_HELP` (`tutor-authoring.ts`). Only the Tutor makes layer Proposals from now on (roles-and-contract 11); the check sits in `propose()`, where every Proposal goes through.
- **Not checked:** that the cited code says what the claim says. The core only proves the file and lines exist.

Tests: `test/evidence.test.ts` (9); the legend-check fixture (`test/fixtures/legend-check/.aidea`) now has an inferred and an unknown Node on each layer, so the legend check covers the new marks. `npm run verify`: 1046 pass, 0 fail. Looked at live in Chromium through Playwright (marks, details, Proposal card, legend); not in Vivaldi. `.scratch/layer-inference/live-scripts/serve-evidence.mjs` serves it.
