# Two changes since the v1 spec: the Probe belongs to each layer, and other languages are no longer out of scope

The v1 spec (`.scratch/aidea-v1/spec.md`) was written before the Tutor was designed in detail (`.scratch/tutor/spec.md`) and before ADR 0004. Two of its statements no longer hold. The spec keeps its original text; this record says what replaced them.

## The Probe moved from project creation to each layer

User story 41 gave the Probe once, when a Project is created, limited to the concepts the Project depends on. The Tutor spec replaces it: a short Probe (at most five questions) comes before the first class of each Layer, skips what the Learner graph already shows, and always offers "I already know this". Reason: what a person needs to know to write the Business layer is not what they need for Architecture, and one assessment at creation would be stale or too long. The Probe entry in `GLOSSARY.md` follows the Tutor spec.

## Other languages are no longer out of scope

The spec's Out of Scope lists "Support for languages other than Python (C# is next)". ADR 0004 changed that: Python is the first supported language, not the only one, and the direction is a language adapter, with TypeScript and JavaScript as the second language (so aidea can run on its own code) instead of C#. The work is not scheduled; until it is, text that is not about a Python-specific fact does not say "Python".

## Consequences

- Where the spec and this record disagree, this record wins.
- Nothing in the code changes because of this record.
