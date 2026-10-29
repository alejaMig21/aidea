# 01: A language adapter interface, with Python as the first adapter

**What to build:** ADR 0004 says aidea must not stay Python-only. The Python work is five scripts behind one module (`python.ts`) called from three routes. Introduce one interface for a language adapter (analyse a project into modules, classes, functions and relationships with their Resolution; build the flow graph of one function; run one function with test data) and a registry, move the Python code behind it as the first adapter, and make the three routes go through the registry. No behaviour changes for Python projects.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Every existing test passes unchanged; the routes no longer import the Python module directly.
- [x] A test registers a fake adapter and shows the routes use it (analysis, flow and run), and that an adapter that does not support an operation answers with a plain-words error instead of a crash.
- [x] The interface and its three operations are written down in the adapter file's header comment, with what each returns (the shapes already used by the routes).
- [x] No new dependency.
