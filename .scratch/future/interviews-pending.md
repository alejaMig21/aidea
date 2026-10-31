# Interviews pending (to resume with `/grill-with-docs`)

Ideas the person raised on 2026-10-31 that need an interview before they can become a spec or tickets. The person says "interview me" and the agent goes straight to the first open question of the chosen topic. Nothing here is scheduled; the first version of aidea comes first. Background for each topic is in `.scratch/future/ideas.md`.

Suggested order: 1 (everything else leans on it), then 2, 3, 4, 5, 6.

## 1. Run the whole project ("Play")
Raised 2026-10-31. Today the Run panel runs ONE function with test data (Playback; the core only starts the builder, the Python playback script and the Python environment lookup). Nothing starts a whole project. The name Run suggests it does. A modern IDE brings up the backend, the frontend and the rest by itself.
- What does "the project is running" mean: the processes are alive, a port answers, a page opens?
- Who decides HOW to start it: an agent that reads the project and orchestrates (flexible, costly, not repeatable), a run configuration written once (repeatable, needs someone to write it), or the hybrid in which the agent proposes the configuration once as a Proposal and the person keeps it? (The person suspects an agent may be "a missile for an ant".)
- Where is the knowledge kept (a file in `.aidea/`, in the repository, in the preferences)?
- Order and dependencies between parts (database, backend, frontend), waiting until each is ready, stopping all, restarting one.
- Where do the processes and their output show up: in the Run panel, in a terminal section (topic 3)? Does the Run panel keep its name or is "Run" renamed so it is not mistaken for the project player?
- Security: it runs code and commands of the project; relation to the Builder's permission cards.

## 2. Plugins
Kinds of plugin (a Panel, a language adapter, a layer or drawing, Tutor content, a Preset pack); the extension points and API; install, enable, remove; what a plugin may do and how it is trusted.

## 3. A terminal section
A Panel to run commands and watch processes. Shell in the Project folder; relation to the Builder's permission cards and to topics 1 and Run; a native pseudo-terminal dependency (ADR 0003 asks for no new dependency without a reason); what the person sees of processes aidea started.

## 4. Project versions (first plugin we write)
Plugin first or a normal Panel first and converted later; what is shown (commits, branches, what changed); the Canvas at a past version (`.aidea/` lives in the repository).

## 5. Networking and deployment in the Architecture layer
Today: C4 boxes, an `external` flag, relations with a label and a `technology`. Missing: where each part runs (hosts, ports, networks, boundaries). Scope of a deployment view; new kinds (database, queue, network boundary); authored or derived.

## 6. Guided, game-like journeys for a complete beginner
Two journeys: a public repository that is not theirs (understand first), and a new project from zero. Decisions: how to be "game-like" when the Tutor spec says no score or level is kept (story 31); is "someone else's repository" understand-only or also contribute (fork, branch, pull request); the default language for a beginner. Gaps found: no `git clone`, no reconstruction of Business and Requirements from code, no environment setup, and the guide predates the Panels, Files, Code, Run and the saved Layout.

## 7. Decisions of the first version that wait for the person (short, not interviews)
- DECISION 5 in `.scratch/overnight/LOG.md`: the shape contract for Playback values (written by an agent).
- Files lists ignored folders (closed, in italics) instead of omitting them.
- Merge the Canvas's own title bar with the layer bar (it would remove a double bar).
- Ticket `layout-and-data/05`: choose the visual effect; the agent shows three options live.
- `language-adapters/05`: the security decision about running TypeScript and JavaScript.
