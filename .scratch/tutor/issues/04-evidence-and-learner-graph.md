# 04: Evidence and the Learner graph

**What to build:** What the person does in a class is recorded in two places under the user's aidea folder, outside any Project. Evidence: an append-only ledger with one entry per answer (class, question, correct or not, confidence, the free text, time). Learner graph: append-only line-oriented files of Propositions (name, statement, aliases, provenance: class and message, and the Project Node when relevant) and Reasoning chains (premises, conclusion, provenance). At the end of a class a pipeline builds the graph from the Teacher's prose only: an Extractor session proposes Propositions and chains, an Auditor session finds duplicates and near-duplicates, and a deterministic program that uses no model is the only writer: identifiers are derived from the normalised name, so the same input gives the same graph. The person's answers never enter the graph. A route lists what has been recorded; an idea can be deleted together with its chains but not edited. A class is not closed until the pipeline has run; if it fails the class stays open for retry and nothing is half written.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Through the protocol with scripted fake Extractor and Auditor outputs: fixed Teacher prose and fixed extractor output give exactly the expected Propositions and chains, and running it twice gives the same graph with no duplicates.
- [ ] Two Propositions with the same normalised name merge and keep both aliases and both provenances.
- [ ] Evidence entries are written for every answer, including "don't know", and are never written to the graph.
- [ ] Deleting an idea removes it and its chains and nothing else; there is no edit route.
- [ ] A failure in the pipeline leaves the ledger and graph unchanged and the class retryable.
- [ ] The stores live outside the Project folder and survive a core restart; the folder is injectable for tests.
