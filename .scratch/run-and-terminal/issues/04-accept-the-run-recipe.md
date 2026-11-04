# 04: Play asks the person to accept the run recipe

**What to build:** A Play control in the top bar, beside the Panels menu (GLOSSARY.md's header rule gets an exception: actions yes, Panels no). The Project's run recipe is a file in its authored area, written by hand for now, listing parts with a name, a command, a folder, the parts each waits for, a ready signal, a time limit and environment variable names. The guard that protects the authored area recognises the file. Pressing Play with a recipe the person has not accepted on this machine shows the WHOLE recipe the first time and asks to accept; the core remembers the accepted recipe by a hash, keyed by the Project path, in the preferences file and never in the repository. A recipe that later differs shows ONLY what changed and asks again. Nothing is started yet. See `.scratch/run-and-terminal/spec.md` (stories 6 to 12, 24 and the Implementation Decisions on consent).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A recipe with a missing or invalid field is refused with a message that names the field.
- [ ] The authored-area guard accepts the recipe file and still reports files outside the known set.
- [ ] Play with no recipe says there is none and how to get one.
- [ ] First acceptance shows the whole recipe; accepting it is remembered across a core restart on another port.
- [ ] Any change to the file (a pull, a hand edit, the Builder) asks again and shows only the difference.
- [ ] The accepted-recipe memory is not in the Project folder.
- [ ] Core API tests (accept, refuse, changed, restart) and page tests (top bar, confirmation) pass.
- [ ] GLOSSARY.md has the run recipe, part, ready signal and Play, and the exception to the header rule.
- [ ] Verified live on the second monitor.
