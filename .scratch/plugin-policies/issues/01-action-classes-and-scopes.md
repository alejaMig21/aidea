# 01: Actions carry a class and a scope

**What to build:** A closed list of classes of action and the scope of each: writes inside the Project (code, authored layers), writes outside the Project, runs a program, uses the network, reads secrets. Plugins declare the classes they use (the scan compares with what their code does, as with capabilities today), and the kernel tags every action it mediates with its class and scope. The list is written in `docs/plugin-api.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The list of classes and scopes exists in `docs/plugin-api.md` and in the code, closed.
- [ ] A plugin that declares a class it does not use, or uses one it did not declare, is a scan finding.
- [ ] An action mediated by the kernel arrives at the guard with its class, scope, and the plugin that did it.
- [ ] Core API tests pass.

Source: `.scratch/plugin-policies/spec.md`.
