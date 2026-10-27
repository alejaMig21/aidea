# Derived layers come from code; authored layers are linked, never generating code

Low layers (modules, classes, data model, call flow) are computed from the code. High layers (business model, requirements, decisions) are written and linked to the code by trace links. aidea never generates code from a diagram, because model-driven approaches such as UML-to-code drift out of sync and get abandoned. When code changes, derived layers recompute and trace links that lost their target are marked broken, which also gives the tutor questions to ask.

## Consequences

- Derivation quality depends on static analysis, so the first supported project language must be one with strong tooling.
