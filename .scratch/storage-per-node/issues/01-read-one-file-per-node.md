# 01: Authored layers can be read from one file per Node

**What to build:** ADR 0005 decided that the Business, Requirements and Architecture layers are stored as one file per Node so two people rarely collide in git. This is the first step (expand): the core also reads `.aidea/<layer>/<node-id>.json` (one Node per file, same shape as today's Node) next to today's `.aidea/<layer>.json`, and Architecture Pattern groups can live in `.aidea/architecture/patterns/<group-id>.json`. Both forms give the same drawn result, the same problems list and the same Contract. A Node id found in both forms is reported as a problem and the per-Node file wins. A bad file is dropped alone with its error, like a bad Node today. Nothing is written in the new form yet.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Through the protocol on fixtures: a project stored per Node and the same project stored as one file per layer produce identical `/authored`, `/layout`, `/contract` and `/traces` results.
- [x] A Node id in both forms is reported as a problem naming both files; a malformed Node file is dropped with its error and the other files still load.
- [x] Pattern groups in their own files load, validate and draw as today; a group file that names a missing Node is a problem like other bad data.
- [x] The Tutor's read tools, the Contract and the drift list see Nodes from both forms. (`/contract` and `/drift` are compared in the first test; `read_layers` and `read_node` in the last test of `test/authored-per-node.test.ts`, with a stub Project that has no code Nodes.)
- [x] Existing projects (single file per layer) work unchanged, with every existing test passing. (`npm run verify` green, 2026-11-04.)
