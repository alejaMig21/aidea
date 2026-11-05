# 06: The Contract plugin offers its rule: what is not in the Contract is not developed

**What to build:** With the Contract plugin on and an approved Contract, a policy denies writes inside the Project that no task of the Contract covers, to any plugin; a small change outside goes through a Proposal that adds it to the Contract. With the plugin off, or with no approved Contract, there is no rule. The rule names no Builder. It is hard and is meant to be tuned after real use.

**Blocked by:** 02, roles-and-contract 04, roles-and-contract 06

**Status:** ready-for-agent

- [ ] With an approved Contract, a Builder that writes a file no task covers is stopped (prevented where mediated, detected and reverted where not) and told which task is missing.
- [ ] A Proposal that adds the change to the Contract, once accepted, lets the write through.
- [ ] With the plugin off the same write passes.
- [ ] A Builder made with Creator Mode is held by the same rule (a fixture proves it).

Source: `.scratch/plugin-policies/spec.md`.
