# 08: Environment variables listed by name, values from the project's own `.env`

**What to build:** A part of the recipe lists the environment variables it needs by NAME only. Their values come from the Project's own environment file, which the repository already ignores; aidea never copies, stores or shows the values. When a variable is missing the part fails and aidea says which one. See `.scratch/run-and-terminal/spec.md` (stories 22 and 23).

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] A part receives the variables it lists, with the values from the Project's environment file, and no others from that file.
- [ ] A recipe that contains a value instead of a name is refused when it is validated.
- [ ] A missing variable fails that part with a message that names it, following the failure rules of the start order once ticket 06 exists.
- [ ] The values appear nowhere in the preferences file, the recipe, the page or the logs of the core.
- [ ] Core API tests with a test environment file pass.
- [ ] Verified live on the second monitor.
