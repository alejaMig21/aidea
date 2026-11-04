# Rules for the local builder

You are the builder of a ticket. The failing checks already exist in `test/`; make them pass with the smallest change.

- Run `npm run verify` (typecheck and tests). It must be green before you stop.
- Never edit anything under `test/`, `package.json`, `AGENTS.md`, `CLAUDE.md`, `GLOSSARY.md` or `docs/`. If a check seems wrong, stop and say so.
- Read `GLOSSARY.md` for the words to use; keep to them in code and in text the person sees.
- The interface is plain JavaScript in `src/ui/features/*.js`, inlined into one page that shares one global scope: prefix every new name with its feature. No new dependency, no framework.
- Sizes, colours and alignment of anything in `src/ui` come from `docs/agents/ui-style.md`.
- Text the person sees is English.
- Do not commit; the loop commits.
