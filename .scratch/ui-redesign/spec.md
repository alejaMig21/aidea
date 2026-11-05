# Interface redesign: Home, work session and columns

Status: built (audit 2026-11-04: see the ticket headers)

## Problem Statement

The person who opens aidea today meets an interface that works but is unfinished and, at times, hostile:

- Opening a Project means typing its path by hand; aidea does not remember Projects, so every launch starts from nothing.
- To play an Algorithm the person must write the arguments as JSON (`[130]`, `{}`), which people who do not know JSON cannot do, and which looks like a request-builder tool rather than a workspace.
- The chat grows and squeezes the Canvas; the layer buttons cover the first Node.
- The panel that should belong to the Tutor shows nothing about it, and the panel that does show content (the Algorithm test data) is the wrong place for it.
- The look is plain and uneven, which makes aidea feel less trustworthy than the tools the person already uses.

## Solution

Redesign the window in two screens, following two mockups the person chose (published as a private "Design" Artifact; see Further Notes):

- **Home** (shown when no Project is open): a title, "Open folder" and "New project" buttons, and the list of recent Projects with their folder and when each was last opened. Choosing one opens it.
- **Work session** (a Project is open): a top bar with a Project switcher (the current Project, the recent ones, "Open folder…"), and below it, three areas side by side: the **chat** on the left, the **Canvas** in the centre, and a **right slot** whose tabs are the **Tutor column** and the **Algorithm column**. The Layers appear as a tab bar on top of the Canvas: Business, Requirements and Architecture (authored, amber), then Components, Algorithms and Code (derived, teal).

The chat and the right slot can be resized and folded away; the Canvas gets what remains and never shrinks below a usable width. The Tutor column is always available and says what the Tutor will do until it exists. The Algorithm column appears only while an Algorithm is open and holds a form with one field per parameter, already filled with suggested examples written the way a Python programmer writes values, plus the Playback. The person never has to write JSON.

## User Stories

1. As a person opening aidea, I want to see a Home screen with my recent Projects, so that I can resume work without remembering paths.
2. As a person opening aidea for the first time, I want the Home screen to explain the two ways to start (open a folder, create a project) with an empty recents list, so that I know what to do.
3. As a person, I want "Open folder" to show the system's folder picker, so that I do not have to type a path.
4. As a person, I want a folder I open to be added to my recents, so that it is there next time.
5. As a person, I want recents ordered by last opened, newest first, so that what I am working on is on top.
6. As a person, I want opening the same folder twice to move it to the top instead of listing it twice, so that the list stays clean.
7. As a person, I want each recent entry to show the folder name, its full path and when I last opened it, so that I can tell similar Projects apart.
8. As a person, I want a recent entry whose folder no longer exists to be marked unavailable instead of failing silently or disappearing, so that I understand what happened and can remove it.
9. As a person, I want to remove an entry from my recents without touching the folder on disk, so that I can tidy the list safely.
10. As a person, I want my recents to survive closing and reopening aidea, so that the list is trustworthy.
11. As a person, I want the list of recents to stay at a reasonable length (the oldest drop off), so that it does not grow forever.
12. As a person, I want "New project" to ask me for a parent folder and a name and create the folder for me, so that I can start from nothing.
13. As a person, I want "New project" to refuse a name that already exists or is not a valid folder name and tell me why, so that I do not overwrite anything.
14. As a person with a Project open, I want a Project switcher in the top bar that shows the current Project and my recents, so that I can change Project without going Home.
15. As a person, I want the switcher's "Open folder…" to behave exactly like the one on the Home screen, so that there is one way to do it.
16. As a person, I want to get back to the Home screen from the work session, so that I can see all my recents and create a new Project.
17. As a person, I want the Layers shown as a tab bar on top of the Canvas, so that they never cover a Node.
18. As a person, I want the authored Layers and the derived Layers visibly grouped by colour, so that I know which ones are written by people and which come from code.
19. As a person, I want the selected Layer clearly marked, so that I always know where I am.
20. As a person, I want a tab to show how many Proposals are waiting on that Layer, so that I do not miss one.
21. As a person, I want a Proposal to look different from accepted Nodes (dashed accent outline), so that I can tell what is pending.
22. As a person, I want to drag the edge of the chat to resize it and fold it away entirely, so that I can give the Canvas the room it needs.
23. As a person, I want the Canvas to keep a minimum usable width however I resize the other areas, so that the chat can never squeeze it out.
24. As a person, I want my column sizes and folded state remembered between sessions, so that I do not have to rearrange every time.
25. As a person, I want to fold and unfold the chat and the right slot from buttons in the top bar, so that I can do it without hunting for the edge.
26. As a person, I want the Tutor column always one tab away, even before the Tutor exists, so that I know where it will live.
27. As a person, I want the Tutor column to say plainly that the Tutor is not available yet and what it will do, so that the empty space does not look like a bug.
28. As a person, I want the Algorithm column to appear when I open an Algorithm and to go away when I leave it, so that it is there only when it is useful.
29. As a person, I want the right slot to switch to the Algorithm tab by itself when I open an Algorithm, so that I do not have to look for the test data.
30. As a person testing an Algorithm, I want one field per parameter of the function, labelled with the parameter's name, so that I know what each value is.
31. As a person testing an Algorithm, I want each field already filled with a suggested example, so that I can see the format and run it straight away.
32. As a person, I want the suggestion to come from the function's own default value or type annotation when it has one, so that the example makes sense for that function.
33. As a person, I want a field with no way to suggest a value to be empty with a hint instead of a made-up value, so that the form does not mislead me.
34. As a person, I want a "Use example" button that refills the fields with the suggestions, so that I can recover after experimenting.
35. As a person, I want to write values as I would in Python (`3`, `"hi"`, `[1, 2, 3]`, `None`, `True`), so that I do not need to learn another format.
36. As a person, I want an invalid value to be reported on its own field, naming the parameter and what is wrong, so that I can fix it.
37. As a person, I want a value that is not a plain literal (a call such as `__import__("os")`, a name, an expression) to be refused and never run, so that typing in the form can never execute code.
38. As a person testing a method, I want fields for the constructor's parameters too, so that the instance can be built without JSON.
39. As a person testing an Algorithm that reads files or calls the network, I want the data for those effects as labelled rows, each prefilled with a sample, so that I can fake them without writing an object by hand.
40. As a person, I want to keep the existing choice of running with the Project's own Python and its warning, so that nothing about safety gets weaker in the redesign.
41. As a person, I want the Playback controls (play, pause, step, scrub) and the values at each step in the same column as the form, so that testing is one place.
42. As a person, I want the dark look to be legible everywhere (text, borders, focus rings), so that long sessions are comfortable and keyboard users can see where they are.
43. As a person using the keyboard, I want every button, tab and field reachable and labelled, so that the interface is usable without a mouse.
44. As a person, I want the desktop window to have no default menu and to open no console window, so that aidea looks like a normal application (already done).
45. As a person, I want fonts to load without an internet connection, so that the window looks the same offline.
46. As a person, I want the permission cards, Proposals and Tutor-to-come to keep working in the new layout, so that nothing already built regresses.

## Implementation Decisions

- **Two screens, one window.** Home and work session are two states of the same interface, not two windows. With no Project open, Home is shown; opening a Project switches to the work session; a way back to Home exists from the top bar.
- **Recents belong to the core.** The core remembers the Projects the person has opened, in a per-user location outside any Project, so every interface shares them and a Project's own files stay untouched. An entry has the folder path, its display name (the folder's name) and the time it was last opened. Order is last opened first; the same path never appears twice; the list is capped (20 entries) and the oldest drop off. An entry whose folder is missing is reported as unavailable, never deleted automatically; the person removes entries explicitly. Removing an entry never touches the folder. The core exposes: list recents, remember a Project on open, forget an entry. Opening a Project through the existing route also records it.
- **Folder picker is a desktop-shell capability.** The system's folder picker is provided by the desktop shell to the interface; the core never shows dialogs. When the interface runs without the shell (a plain browser, live tests), a typed path remains as a fallback so the interface stays testable.
- **"New project".** The person chooses a parent folder and a name; the core creates the folder (refusing existing names and invalid folder names with a clear message) and opens it as a Project. It creates an empty folder only; templates are out of scope.
- **Layout.** Top bar (brand, Project switcher, fold buttons), then chat, Canvas and right slot in that order. Chat and right slot are resizable and foldable, with sizes and folded state remembered per person. The Canvas takes the remaining width and has a minimum width that the other areas cannot take from it. The Layer tab bar sits in a reserved strip on top of the Canvas so Nodes are never covered.
- **Right slot.** Tabs: Tutor (always) and Algorithm (only while an Algorithm is open, selected automatically when one opens). On narrow windows the two columns share the slot through the tabs; on wide windows both may be shown side by side (the mockup of that option exists but was not chosen, so the shared slot is the default).
- **Tutor column.** An empty state that says the Tutor is not available yet and what it will do, with the entry point disabled. It holds nothing else. The Tutor itself is built under the existing tickets.
- **Algorithm column.** Holds the test-data form, the optional own-Python switch with its warning, and the Playback. The Canvas keeps drawing the Algorithm graph.
- **Test-data form.** The Algorithm analysis reports each parameter of the function (and of the constructor for a method) with its default value and type annotation when present. Suggested examples come, in order, from the default value, then the annotation (a small, plain example per basic type), else none (empty field with a hint). Values are Python literals. The core evaluates them with a literal-only evaluator: anything that is not a plain literal (calls, names, operators, comprehensions) is refused with an error naming the parameter and is never executed. The Playback request carries the values per parameter instead of one JSON list; effects data is a set of named rows with sample values, also literals. The existing safeguards of the Playback (limits, static effect check, own-Python opt-in, timeouts) do not change.
- **Look.** Dark theme; Inter for text and JetBrains Mono for code, shipped with the application so no network is needed; accent blue, amber for authored Layers, teal for derived Layers, dashed accent outline for Proposals; real buttons, labels, visible focus and text contrast of at least 4.5:1. Following the system's light or dark setting is open and not part of this spec.
- **Plain web code.** The interface stays plain JavaScript and CSS with no new framework, as today. ADR 0003 mentions the dropped OpenCode direction and is stale: it must be rewritten as an ADR about the interface technology without that reference, or removed. The person paused that cleanup, so the implementer asks before doing it.
- **Glossary.** Terms Column, Tutor column and Algorithm column already exist. Add "Recent project" (a Project the person opened before, kept in a list, which may be unavailable) and "Home" (the screen shown when no Project is open) when the work lands.
- **Already done** and not to be redone: the default desktop menu removal and hiding the core's console window.

## Testing Decisions

- **Good test**: only external behaviour through the core's HTTP protocol, which is the one seam (the same as every ticket so far). No test reaches into modules, files the core owns, or the interface.
- **Prior art**: the existing core-protocol tests using the test helpers that start a core and copy fixtures, including the playback and algorithm tests for argument handling and the permission and proposals tests for per-conversation behaviour.
- **To be tested through the protocol**: recents (a Project opened appears first; reopening does not duplicate; order by last opened; cap respected; unavailable folder is flagged, not dropped; forgetting removes only the entry; entries survive a core restart; folder that is not a directory or does not exist is refused; "New project" creates the folder, refuses existing and invalid names); the Algorithm analysis (parameters in order, defaults and annotations, constructor parameters of a method, suggested examples); the Playback with literal values (valid literals of each basic type run; a malformed literal is reported against its parameter; a call, a name or an expression is refused and demonstrably not run; size limits; the previous guarantees still hold).
- **Not tested automatically**: the folder picker, layout, folding and resizing, the look and the Tutor empty state. They are checked live on the second monitor with the browser tool and the real window, as in earlier tickets, and the results go in each ticket's review notes.

## Out of Scope

- The Tutor itself (tickets 10 to 16) and its content; only the empty column is in scope.
- The permission mode and model selector (ticket 17).
- A list of conversations per Project, command palette, settings screens, side panels for files, review or terminal.
- Following the system's light or dark setting, and a light theme.
- Project templates for "New project".
- Imitating or integrating OpenCode, in any form.
- Automated interface tests.
- Packaging an installer.

## Further Notes

- **Mockups** (private Design Artifact, only the owner can open it): https://claude.ai/artifact/9NVTcYF3zj18euQkXhcZ4B. Chosen: board C (Home) as drawn and board A (work session) with the Layer tab bar from board B. Board B (project sidebar with both columns open) was not chosen. The mockup's example copy is English, matching the interface.
- The person's earlier notes this spec answers: layer buttons covering the first Node, chat squeezing the Canvas, nothing about the Tutor in its column, the test data form asking for JSON, the terminal opening behind the app, the default menu.
- Stale material to clean up (paused by the person): ADR 0003, and the untracked OpenCode research note under `.scratch/aidea-v1/research/`. The person's own clone of OpenCode outside the repository is left alone.
- Decisions are also recorded in the project memory under the topics "decision/ui-mockups-chosen" and the superseded "decision/ui-redesign-opencode".
- Next step: break this spec into tickets in a fresh session (the person plans to implement the redesign there); the first slice should be the Home screen with recents, since it is the only part that needs new core behaviour on its own.
