# Interviews pending (to resume with `/grill-with-docs`)

Ideas the person raised on 2026-10-31 that need an interview before they can become a spec or tickets. The person says "interview me" and the agent goes straight to the first open question of the chosen topic. Nothing here is scheduled; the first version of aidea comes first. Background for each topic is in `.scratch/future/ideas.md`.

Suggested order: 1 (everything else leans on it), then 2, 3, 4, 5, 6.

## 1. Run the whole project ("Play")
Raised 2026-10-31. Today the Run panel runs ONE function with test data (Playback; the core only starts the builder, the Python playback script and the Python environment lookup). Nothing starts a whole project. The name Run suggests it does. A modern IDE brings up the backend, the frontend and the rest by itself.
- DECIDED 2026-11-03: "the project is running" means its processes are alive (they started and have not exited). Not a port check, not a page. Consequence to settle later: a hung process counts as running, and "wait until the database is ready before starting the backend" cannot rest on this definition alone.
- Who decides HOW to start it: an agent that reads the project and orchestrates (flexible, costly, not repeatable), a run configuration written once (repeatable, needs someone to write it), or the hybrid in which the agent proposes the configuration once as a Proposal and the person keeps it? (The person suspects an agent may be "a missile for an ant".)
- DECIDED 2026-11-03: the hybrid. An agent reads the project ONCE and proposes the run recipe (commands, folders, order) as a Proposal; the person accepts or corrects it; from then on the project starts from the recipe with no agent. The person can ask the agent to review the recipe when the project changes. Reason: starting a project every day must cost no tokens and always start the same way, while writing the first recipe by hand is where a beginner gets stuck.
- DECIDED 2026-11-03: the recipe is a file inside the Project's `.aidea/` folder (for example `.aidea/run.json`), so it travels with the repository. Consequence: the Proposal flow and the guard that protects `.aidea/` must learn this new kind of file (the guard reports files outside the known set).
- DECIDED 2026-11-03: order PLUS a "ready" signal per part. The recipe says when a part counts as ready for the next one to start (for example a port that answers, or a line that appears in its output). This is a second notion, separate from "running" (processes alive): running is what the Play state shows, ready only gates the start order. Open: what happens when a part never becomes ready (a time limit, then say which part and why), and whether the agent that proposes the recipe also proposes each signal.
- DECIDED 2026-11-03: each part has a time limit to become ready (a default, for example 60 seconds, adjustable in the recipe). When a part exceeds it, Play stops everything it had already started and shows which part failed and the last lines it wrote; the part's tab keeps its text. Reason: a clean state after a failure (no loose processes, no busy ports) matters more than keeping processes alive, and a beginner can retry without hitting a busy port. Not chosen: leaving the started parts running, and waiting with no limit.
- DECIDED 2026-11-03: restarting one part also restarts everything that depends on it, in order, waiting for each "ready" signal. The person chose it for autonomy (aidea handles the consequences) even though it overlaps with "stop all" plus Play, and even though it restarts parts that did not need it (restarting the backend restarts the frontend). Open consequence: a quicker "restart only this part" may still be wanted later. Stop all: proposed, not contradicted, to stop in the reverse of the start order (front end first, database last); confirm when the interview resumes.
- DECIDED 2026-11-03: closing aidea while the project runs stops everything aidea started, after a warning ("a project is running, close and stop it?"). Nothing is reconnected on the next launch. Reason: closing aidea always leaves the machine as it was found; recognising processes from an earlier session is the most fragile part of the design and a failure leaves busy ports a beginner cannot free. Reconnecting can be added later as an option.
- Order and dependencies between parts (database, backend, frontend), waiting until each is ready, stopping all, restarting one: all decided above except the points marked open.
- DECIDED 2026-11-03: the processes and their output show in the terminal section (topic 3), not in the Run panel and not in a new Panel of their own. Consequence: Play cannot be built before the terminal section exists, so topic 3 is now a dependency of topic 1. The agent had recommended a separate Panel; the person chose the terminal.
- DECIDED 2026-11-03: the Panel that today is called Run (the Playback of one function, only available while a Flow is open) is renamed "Playback", the name GLOSSARY.md already uses for that feature. "Run" becomes the word for running the whole project, as in any IDE. The internal id `run` can stay, so saved Layouts keep working; the title, the Panels menu, GLOSSARY.md and the test that guards the retired names change.
- DECIDED 2026-11-03 (security): the person's permission is tied to the EXACT recipe accepted on this machine. aidea remembers which recipe was accepted; if the file is different for any reason (a pull, a hand edit, the Builder), Play shows the new recipe and asks for confirmation before starting anything. Same idea as the guard of `.aidea/` authored files. Why: Play cannot use Playback's sandbox (it must start processes, open ports and write files), and the recipe travels with the repository, so a cloned or pulled recipe could carry commands the person never saw. Not chosen: accepting once for good (a changed recipe would run unseen) and one permission card per command (defeats "Play").
- Security, still open: where the accepted-recipe memory lives (it must not live in the repository, or a pull could overwrite it), and what the confirmation shows (the whole recipe, or only what changed).

### Topic 1: interview done on 2026-11-03; what is left
Decided: running = processes alive; a recipe in `.aidea/` proposed once by an agent and accepted by the person; consent tied to the exact recipe; order plus a "ready" signal per part, with a time limit that stops everything on failure; output in the terminal section (view-only first); restart one part = it and its dependents in order; closing aidea stops what it started; Run panel renamed Playback and "Run" means the whole project.
Open, to settle before a spec:
- Where the Run control lives. The rule in GLOSSARY.md says the Panels menu is the only header control and no Panel has buttons of its own; Run is an action, not a Panel toggle. Top bar, inside the terminal section, or both?
- Where the "accepted recipe" memory lives (not in the repository), and what the confirmation shows (all of it, or the change).
- Who proposes each "ready" signal (the same agent), and what a part with no port or output to watch uses (a Telegram bot, a background program).
- Stop all in the reverse of the start order (proposed, not yet confirmed), and whether a quicker "restart only this part" is wanted later.
- The terminal section (topic 3) is now a prerequisite: its interactive console, native dependency and security rule are still to interview.
- The recipe format itself (parts, commands, folders, environment variables, secrets such as a `.env`, ready signal, time limit).

## 2. Plugins
Kinds of plugin (a Panel, a language adapter, a layer or drawing, Tutor content, a Preset pack); the extension points and API; install, enable, remove; what a plugin may do and how it is trusted.

## 3. A terminal section
DECIDED 2026-11-03 (during topic 1): the first version only SHOWS. One tab per process that Play started, with its output, its state (alive or exited) and stop and restart buttons; nothing can be typed. It is built so that a second kind of tab, an interactive console, can be added later without redoing the first. The interactive console (and its native pseudo-terminal dependency and its security rule) stays open for a later interview.

Original notes: A Panel to run commands and watch processes. Shell in the Project folder; relation to the Builder's permission cards and to topics 1 and Run; a native pseudo-terminal dependency (ADR 0003 asks for no new dependency without a reason); what the person sees of processes aidea started.

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
