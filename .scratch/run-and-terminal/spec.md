# Run the whole project, and the terminal

Status: ready-for-agent

Source: the interviews of 2026-11-03 and 2026-11-04, recorded in `.scratch/future/interviews-pending.md` (topics 1 and 3). Every decision below was made by the person; the agent's own recommendations are noted only where the person chose otherwise.

## Problem Statement

A person who opens a project in aidea cannot start it. The Run panel runs ONE function with test data (Playback), yet its name suggests it runs the project. A modern IDE brings up the database, the backend and the frontend by itself; in aidea the person has to start each program by hand, in the right order, in a terminal outside aidea, and when something fails they have to read the error somewhere else and carry it back to the Builder or the Tutor by copy and paste.

## Solution

A **Play** control in the top bar starts every program of the Project, in the right order, from a **run recipe** that an agent proposes once and the person accepts. The programs' output appears in a new **terminal** Panel, one tab per program, view only. When something fails, the person selects the error text with the mouse and chooses what to do with it: have the Tutor explain it, have the Builder fix it, or both. The Panel that today is called Run becomes **Playback**, the name GLOSSARY.md already uses for that feature; "Run" then means running the whole project, as in any IDE.

## User Stories

### The recipe and the person's consent
1. As a person with a project made of several programs, I want to press Play and have all of them start, so that I do not start the backend, the frontend and the rest by hand.
2. As a person, I want an agent to read my Project once and propose the run recipe as a Proposal, so that I do not have to write it myself.
3. As a person, I want to accept or correct the proposed recipe, so that it matches how my project really starts.
4. As a person, I want to ask the agent to review the recipe when my project changes, so that it does not go stale.
5. As a person, I want Play to start the project from the accepted recipe with no agent involved, so that starting it every day costs no tokens and always happens the same way.
6. As a person, I want the recipe kept in my Project's `.aidea/` folder, so that it travels with the repository.
7. As a person, I want aidea to refuse to start anything from a recipe I have not accepted on this machine, so that a cloned or pulled recipe cannot run commands I never saw.
8. As a person, I want to see the whole recipe the first time I am asked to accept it, so that I know every command that will run.
9. As a person, I want to see only what changed when an accepted recipe changes, so that I can review a short change instead of rereading everything.
10. As a person, I want a recipe changed by a pull, a hand edit or the Builder to ask me again, so that no command runs unseen.
11. As a person, I want the memory of what I accepted kept outside the repository, so that a pull cannot overwrite it.

### Parts, order and readiness
12. As a person, I want each part of the recipe to have a name, a command and a folder, so that I can tell what Play starts and where.
13. As a person, I want a part to wait for the parts it depends on, so that the backend does not start before the database can answer.
14. As a person, I want each part to have a ready signal (a port that answers, a line it prints, a file that appears, or a URL that answers), so that waiting is based on a real check.
15. As a person, I want the agent that writes the recipe to propose each ready signal after looking in the code, so that I do not have to find it.
16. As a person, I want the agent to ask me what I see when a part works if it finds nothing observable, so that it never invents a signal.
17. As a person, I want the agent to propose that the Builder add a log line, as a Proposal I can reject, when nothing is observable at all, so that even a silent program can be waited for.
18. As a person, I want a part never to be marked ready without a real check, so that the next part does not start too early.
19. As a person, I want each part to have a time limit to become ready, with a default and an adjustable value in the recipe, so that a stuck part does not wait forever.
20. As a person, I want everything already started to stop when a part exceeds its limit, so that I am left with a clean state, no loose processes and no busy ports.
21. As a person, I want to see which part failed and the last lines it wrote, and its tab to keep its text, so that I can find out why.
22. As a person, I want the recipe to list environment variables by name only, with the values read from the project's own `.env` file, so that the recipe carries no secrets and aidea never copies or stores them.
23. As a person, I want aidea to name the missing variable when a part fails for lack of one, so that I know what to add.

### Controlling the project
24. As a person, I want Play and Stop all in the top bar, always visible, so that I can start and stop the project from anywhere.
25. As a person, I want Play not to open the terminal by itself, so that I who do not want to see it am not forced to.
26. As a person, I want Play to say, when a part fails, which part failed and that opening the terminal shows the errors in depth, with one action to open it, so that I know where to look.
27. As a person, I want Stop all to stop the parts in the reverse of the start order, so that the backend does not print false errors because the database vanished first.
28. As a person, I want to restart one part and have everything that depends on it restart too, in order, waiting for each ready signal, so that the project is left consistent.
29. As a person, I want the project's state to say a part is running while its process is alive, so that "running" has one plain meaning.
30. As a person, I want stopping a part to end its whole process tree, so that no loose process or busy port is left behind.
31. As a person, I want a warning ("a project is running, close and stop it?") when I close aidea while the project runs, and everything aidea started to stop if I confirm, so that closing aidea leaves the machine as it was found.
32. As a person, I want aidea not to reconnect to processes of an earlier session, so that nothing fragile survives a restart.

### The terminal
33. As a person, I want a terminal Panel listed in the Panels menu like any other, so that I can show and hide it.
34. As a person, I want the terminal to start in a full-width strip at the bottom of the window, so that long lines are readable.
35. As a person, I want to move the terminal like any Panel and have the saved Layout remember where I left it, so that my arrangement survives a restart.
36. As a person, I want one tab per process that Play started, so that I can read each program's output apart.
37. As a person, I want each tab to show whether its process is alive or has exited, so that I know its state.
38. As a person, I want stop and restart buttons on each tab, so that I can control one part.
39. As a person, I want the terminal to be view only, so that nothing can be typed into a running program from it.
40. As a person, I want a tab to keep its text after its part exits or fails, so that I can read what happened.
41. As a person, I want a long output to keep only a bounded number of lines and say when older lines were dropped, so that the window stays fast.

### Reading errors with the Tutor and the Builder
42. As a person, I want to select text in the terminal with the mouse and see a small control with four buttons, so that I choose what happens with it.
43. As a person, I want "Explain" to ask the Tutor for a short explanation of the selected text, so that I understand what went wrong.
44. As a person, I want "Fix" to hand the selected text to the Builder, which works knowing the cause and the Contract, so that it repairs the problem without inventing anything.
45. As a person, I want "Explain and fix" to do both, so that I understand and the Builder repairs in one move.
46. As a person, I want "Enter the Tutor" to stay as the way to start a full class on the selected text, so that learning more is one click away.
47. As a person, I want nothing to be read from the terminal unless I select text and press a button, so that the Tutor and the Builder never read it on their own.
48. As a person, I want the same words for the same actions all over aidea ("Explain" replaces "Just define" everywhere), so that controls explain themselves.
49. As a person, I want "Fix" and "Explain and fix" in the terminal and in the Code panel only, so that fixing is offered only where it makes sense.
50. As a person, I want a longer limit for text selected in the terminal (8000 characters) than elsewhere (2000), and the END of a longer selection kept with a notice that it was cut, so that the useful end of a long traceback is not lost.
51. As a person, I want a warning that the selection looks like a secret, with a confirmation before it is sent, and the text never changed, so that I do not send a key by accident.
52. As a person, I want selected terminal text to travel as data and never as an instruction, so that hostile text in an output cannot give orders to the Tutor or the Builder.

### Names
53. As a person, I want the Panel that runs one function to be called Playback, so that "Run" means starting the whole project.
54. As a person, I want my saved Layout to keep working after the rename, so that I do not lose my arrangement.

## Implementation Decisions

- **Run recipe.** One file in the Project's authored area, listing parts. Each part has a name, a command, a folder, the parts it waits for, a ready signal (a port, a line of output, a file or a URL), a time limit in seconds, and environment variable names only. The guard that protects the authored area must learn the new file; today it reports files outside the known set.
- **Proposal.** The recipe reaches the person through the existing Proposal flow, written by an agent that reads the Project once. After acceptance, starting needs no agent.
- **Consent.** The core remembers, in the preferences file and not in the repository, which exact recipe was accepted for a Project path, by a hash of the recipe. Play refuses any other recipe until it is accepted. The confirmation shows the whole recipe the first time and only the difference afterwards.
- **Two notions, kept apart.** "Running" means the process is alive and is what the interface shows. "Ready" is the signal of a part and only gates the start order.
- **Start.** Parts start in dependency order; a part starts when the parts it waits for are ready. If a part is not ready within its limit, everything started is stopped and the failure names the part and its last lines.
- **Restart and stop.** Restarting a part restarts its dependents in order, waiting for each ready signal. Stop all runs in the reverse of the start order. Stopping ends the whole process tree of each part (on Windows this needs more than killing the first process).
- **Closing.** The desktop app warns before closing while a project runs, then stops everything it started; nothing is reconnected on the next launch.
- **Secrets.** The recipe never holds values. Values come from the Project's own environment file; a missing variable fails the part and is named.
- **Output.** The core captures each part's output and keeps a bounded number of lines per tab. The interface receives it as a stream.
- **Terminal Panel.** A normal Panel in the registry, listed in the Panels menu, whose initial place is a new full-width bottom strip. The Layout registry, which knows only the left and right sides today, must learn a bottom zone; the saved Layout remembers moves. It is built so that a second kind of tab (an interactive console) can be added later without redoing the first.
- **Top bar.** Play and Stop all join the Panels menu in the top bar. GLOSSARY.md's header rule gets an exception: actions yes, Panels no. Play does not open the terminal. On failure it shows which part failed and offers a way to open the terminal.
- **Selection control.** It already exists for any selected text. It gains, for terminal text, four buttons (Explain, Fix, Explain and fix, Enter the Tutor), a limit of 8000 characters that keeps the end and says it cut, and a secret check that asks for confirmation. "Just define" is renamed "Explain" in the whole app; "Fix" and "Explain and fix" also appear in the Code panel. The text only travels as data.
- **Tutor and Builder.** Neither reads the terminal on its own. The Tutor keeps its read-only nature (it cannot run commands or change files). The Builder receives the selected text as data together with the Contract it already respects.
- **Rename.** The Panel called Run becomes Playback: its title, the Panels menu, GLOSSARY.md and the test that guards the retired names change; the internal id stays so saved Layouts keep working.
- **ADRs.** ADR 0001 stands (no agent loop of aidea's own). ADR 0003 (plain web code, no new dependency without a reason) holds because the first terminal only shows and needs no native terminal library.

## Testing Decisions

- A good test checks behaviour seen from outside: what the API returns, what the page shows, which processes are alive. It does not look at internal structures.
- **Seam 1, the core API.** Start the core as `test/ui-state.test.ts` does and drive it over HTTP, using tiny REAL child processes as the parts of a test recipe: one that prints a line when ready, one that opens a port, one that never becomes ready, one that exits with an error, one that needs a variable. This covers the recipe's validation, consent and hash, order, ready signals, the time limit and teardown, restart with dependents, reverse stop, the process tree, bounded output, and a refused recipe.
- **Seam 2, the page.** Run the real page in headless Chrome through the existing driver (prior art: `test/layout-save-page.js`). This covers Play and Stop all in the top bar, the failure feedback, the terminal tabs, the four buttons, the 8000 character limit keeping the end, the secret confirmation, the bottom zone of the Layout and its save and restore, and the Playback rename.
- **Live checks.** At the end of each ticket, a live check in the real Electron window on the second monitor (`AIDEA_DISPLAY=secondary`); browser checks use Vivaldi, which is on the second monitor.
- Prior art for the selection control: its existing tests; for the Panel registry: `test/panel-registry.test.ts`; for the saved Layout: `test/layout-save.test.ts`.

## Out of Scope

- The interactive console (typing into the terminal), its native pseudo-terminal dependency and its security rule. Planned after version 1.
- The Deployment layer. It depends on the run recipe and has its own specification.
- Removing Class mode, Direct mode and the decision classes; a separate ticket.
- Detecting and showing warnings (as opposed to failures) from a program's output.
- A quicker "restart only this part" that skips the dependents.
- Reconnecting to processes of an earlier session.
- Plugins, the animation engine, the versions plugin and the guided tutorials.

## Further Notes

- GLOSSARY.md needs: the run recipe, part, ready signal and Play; the terminal; the Playback rename; the exception to the header rule; and the unified wording of the selection control.
- `guide.ts` ("How aidea works") must be updated for Playback, the terminal and Play.
- The Python Playback sandbox cannot be reused for Play, which must start processes, open ports and write files; that is why consent is tied to the exact recipe.
- Open from the interview: how warnings are detected, and whether a quicker single-part restart is wanted later.
