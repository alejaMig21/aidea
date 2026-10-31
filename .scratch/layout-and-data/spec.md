# Panels, Layout and the Data layer: aidea as an environment

Status: ready-for-agent

## Problem Statement

aidea is meant to feel like a classic IDE with AI present, a place where an idea becomes an engineering product through constant learning and real engineering decisions. Today it falls short in four ways, all raised by the person after living with the Code layer:

- **Code is shown the wrong way.** The Canvas is for drawing things. Source text, whole files in a Canvas layer, is not a drawing. The person has to leave the Canvas to read code, and the Code tab is unreachable while the Canvas is hidden.
- **The project's files are invisible.** There is no way to see or browse the folder hierarchy of the Project, which every IDE offers.
- **The window is a fixed set of columns.** Chat, Canvas and a right slot can be resized and folded, but not rearranged. The person wants the freedom Unity gives: panels that can be resized, stacked vertically or horizontally, nested, saved as arrangements, and moved to another monitor.
- **Some names say the wrong thing.** The layer called Algorithms draws the flowchart of one function, not an algorithm. The "Algorithm column" holds the test-data form and the Playback, which has nothing to do with that layer.
- **Values are not drawn.** Playback shows which step is active and a table of values as text. Nothing draws an array, a tree, a dictionary or linked objects as the structure it is, changing as the code runs. That is what makes tools like visualgo.net (structures as the protagonist, animated step by step) and jsoncrack.com (data as an interactive graph or tree) good for learning.

## Solution

aidea becomes a set of **Panels** arranged in a **Layout** the person controls, with **Presets** to save arrangements. Nothing in aidea is tied to one kind of project.

**Vocabulary (decided with the person):**

- **Panel**: one section of the window with one job: Canvas, Files, Code, Builder, Tutor, Run. Each can be shown, hidden, resized and moved.
- **Layout**: how all the Panels are arranged right now (side by side, stacked, nested, in tabs, on which monitor).
- **Preset**: a Layout saved with a name, to return to it in one click.
- **Run**: the Panel that holds the test-data form and the Playback of the open function. It replaces the "Algorithm column", stops sharing a slot with the Tutor and becomes a Panel of its own.
- **Flow**: the new name of the Algorithms layer, the flowchart of one function.
- **Data**: a new layer that draws the values of a function while Playback runs it, as structures, in step with Flow.

**Delivered in four slices, in this order:**

1. **Names.** Flow, Run, Panel, Layout and Preset replace the old words everywhere the person or the Tutor reads them.
2. **Files and Code.** Code stops being a layer. A Files Panel shows the folder hierarchy of the Project. Choosing a file shows its source in the Code Panel. If the file is a Node on the Canvas, that Node shows that its code is being read. The classic IDE arrangement (Files, Code, a bottom area) is one Preset the person can pick, not the default.
3. **Layout.** The Panels become freely dockable, with Presets and the option to place a Panel on another monitor.
4. **Data.** The Data layer, preceded by a short spike that finds out what values Playback can capture and in which languages.

## User Stories

### Names (slice 1)

1. As a person, I want the layer that draws a function's flowchart to be called Flow, so that its name says what it shows.
2. As a person, I want the Layer bar, the help of each layer, the Tutor's explanations and the Legend to say Flow wherever they said Algorithms, so that I never meet two names for one thing.
3. As a person, I want the panel with the test-data form and the Playback to be called Run, so that I understand it as "run this function with these values".
4. As a person, I want Run not to depend on the Tutor sharing its space, so that I can have both visible at once.
5. As a person, I want the words Panel, Layout and Preset used consistently in the interface, so that I can learn them once.
6. As the Tutor, I want the layer help and the class messages to use the new names, so that I teach the same words the person sees.
7. As a maintainer, I want the glossary to define Panel, Layout, Preset, Run, Flow and Data and to retire Column, Algorithm column and Tutor column, so that the vocabulary has one source of truth.
8. As a maintainer, I want a test that fails if an old name (Algorithms layer, Algorithm column, Tutor column) reappears in user-facing text, so that renames do not rot.
9. As a person with a Project already open, I want my existing Projects, recents and authored layers to keep working after the rename, so that I lose nothing.

### Files and Code (slice 2)

10. As a person, I want a Files Panel that shows the folder hierarchy of my Project, so that I can see how it is organised.
11. As a person, I want to expand and collapse folders, so that I can focus on the part I care about.
12. As a person, I want folders that are not part of my work (version-control data, dependency folders, caches, build output) to be left out or folded by default, so that the tree stays readable.
13. As a person, I want to see which files aidea understands (it can analyse their language) apart from the rest, so that I know where the Canvas can help.
14. As a person, I want to choose a file in the Files Panel and have its source appear in the Code Panel, so that browsing files and reading code work as in any IDE.
15. As a person, I want the Code Panel to show the whole file with line numbers and highlighted syntax, so that it is comfortable to read.
16. As a person, I want to open several files and move between them as tabs in the Code Panel, so that I can compare and go back.
17. As a person, I want a file that is too large or is not text to be refused with a plain message, so that nothing hangs.
18. As a person, I want the Code Panel to reflect the file on disk after a change, with a refresh, so that I read what is really there.
19. As a person, I want to choose a file that is a Node on the Canvas and see that Node give a visible sign that I am reading its code, so that I connect the picture with the text.
20. As a person, I want the sign on the Node to disappear when I read another file, so that it always means "this is the one".
21. As a person, I want to choose a Node on the Canvas and have the Code Panel show its file at its lines, so that the link works in both directions.
22. As a person, I want a step of a Flow to show its lines in the Code Panel, so that I see which code a box stands for.
23. As a person, I want "Open in my editor" to keep working from the Code Panel, so that I can edit with my own tools.
24. As a person, I want the Code Panel to be reachable even while the Canvas is hidden, so that the old unreachable-tab problem cannot happen.
25. As a person, I want the Code to no longer appear in the Layer bar, so that the Layer bar lists only things that are drawn.
26. As a person who opens aidea on any folder (a game, a fullstack app, a notebook, my own configuration folder), I want the Files Panel to work even when no language is understood, so that aidea is useful before it can analyse anything.
27. As a person, I want aidea to never write to a Project folder because I browsed it, so that opening a folder of someone else's code is safe.
28. As a person, I want the classic IDE arrangement (Files on the left, Code in the middle, a bottom area) available as a Preset, so that I can work the way I am used to when I choose.

### Layout (slice 3)

29. As a person, I want to show and hide each Panel at will, so that I use the space for what I am doing.
30. As a person, I want to resize Panels by dragging the border between them, so that I decide how much room each gets.
31. As a person, I want to place Panels side by side or one above another, so that I can build the arrangement that fits my screen.
32. As a person, I want to nest arrangements (two Panels stacked inside one half of a split), so that I can reach layouts like Unity's.
33. As a person, I want to put several Panels in one place as tabs, so that rarely used ones do not take room.
34. As a person, I want to drag a Panel by its title to a new place, with a preview of where it will land, so that rearranging is direct.
35. As a person, I want a Panel that cannot be made smaller than a usable size to say so instead of breaking, so that the Layout never becomes unusable.
36. As a person, I want to save my current Layout as a Preset with a name, so that I can return to it.
37. As a person, I want to switch Presets in one click, so that I can change from "reading code" to "teaching" to "debugging" quickly.
38. As a person, I want to rename and delete my Presets, so that the list stays mine.
39. As a person, I want a few Presets that come with aidea (including the classic IDE one and a Canvas-only one) that I cannot lose, so that there is always something to go back to.
40. As a person, I want a "reset layout" action, so that I can recover from a mess.
41. As a person, I want my Layout and Presets to survive closing and reopening aidea, so that I do not rebuild them.
42. As a person, I want Layouts to be remembered per Project or shared across Projects, as I choose, so that a game and a script can have different arrangements.
43. As a person with two monitors, I want to move a Panel (for example Canvas or Run) to the other monitor, so that I use both screens.
44. As a person with two monitors, I want the Panels on the second monitor to stay in step with the main window (same Project, same selected Node, same Playback), so that they feel like one aidea.
45. As a person, I want closing the second monitor's window to bring its Panels back to the main window, so that nothing is lost.
46. As a person on a narrow window, I want Panels to fall back to drawers or tabs instead of becoming unreadable, so that aidea still works on a small screen.
47. As a person, I want dragging and resizing to feel smooth, so that aidea feels as good as the tools I already use.
48. As a person using only the keyboard, I want to focus, show, hide and move between Panels with keys, so that the Layout is accessible.

### Data (slice 4)

49. As a person, I want a Data layer next to Flow, so that I can see the values of the function I am studying.
50. As a person, I want Data to follow the same Playback as Flow and Run, so that all three show the same moment.
51. As a person, I want a list or array drawn as a row of cells with their positions, so that I see order and size.
52. As a person, I want a dictionary or object drawn as keys pointing to values, so that I see its shape.
53. As a person, I want objects that point to other objects (linked lists, trees, graphs) drawn as nodes and arrows, so that I see the structure the code builds.
54. As a person, I want data that has the shape of a tree drawn as a tree, so that it reads the way I know trees.
55. As a person, I want a value that changed since the previous step to be highlighted, so that I see what each step did.
56. As a person, I want the same object referenced from two variables to be drawn once with two names pointing to it, so that I understand aliasing.
57. As a person, I want large values to be cut at a clear limit and say how much is hidden, so that the picture stays readable and aidea stays fast.
58. As a person, I want to step forward and back through the run, so that I can re-watch a moment.
59. As a person, I want to change the speed and use keyboard shortcuts to play, pause and step, so that I control the pace as in visualgo.net.
60. As a person, I want to jump to the start or the end of a run, so that I can restart quickly.
61. As a person, I want to see the variables of the current step by name beside their drawings, so that I can tell what is what.
62. As a person, I want to zoom and move over a large drawing, so that I can inspect it.
63. As a person, I want to export the current drawing as an image, so that I can keep or share it, as in jsoncrack.com.
64. As a person, I want to see the text form of a value next to its drawing, so that I can check one against the other.
65. As a person, I want a value that aidea cannot draw (a file handle, a thread) to appear as a plain labelled box, so that nothing is silently missing.
66. As a person, I want to choose the data for a run from named examples (empty, random, sorted, nearly sorted, many duplicates, as in visualgo.net) when the parameter is a list of numbers, so that I can see how an algorithm behaves on different inputs.
67. As a person whose project is in a language that cannot record values yet, I want Data to say so plainly, so that I know it is a limit and not a bug.
68. As the Tutor, I want to be able to point at a value or a step in Data when I ask the person to predict the next state, so that predictions can be about what they see.
69. As the Tutor, I want the layer help to describe Data (what it is, the guiding question, an example), so that I can teach how to read it.
70. As a person, I want Data not to write anything to my Project, so that watching a run never changes my code.

## Implementation Decisions

- **Panel model.** The window is a tree of Panels. Each Panel has an identity, a place in the Layout and a visible or hidden state. Panels in scope: Canvas, Files, Code, Builder, Tutor, Run. Layers stay inside the Canvas Panel. The old "right slot" and its tabs go away: Tutor and Run become independent Panels.
- **Layout is data.** A Layout is a serialisable description (nesting of splits with direction and sizes, tab groups, hidden Panels, which monitor each Panel is on). A Preset is a Layout with a name. The core stores Layouts and Presets in the per-user preferences store, outside any Project, so a Project folder is never written to for a Layout.
- **Built-in Presets** ship with aidea and cannot be deleted or overwritten: the current arrangement (default), the classic IDE arrangement, and Canvas only. The default stays what the person sees today, with Files and Code hidden until asked for. The classic arrangement is a Preset, never the default.
- **Code is a Panel, not a layer.** The Code layer, its tab, its layer id and its help entries are removed. The floating code box is already gone. The Code Panel renders a whole file with line numbers and highlighted syntax, can highlight a line range, has tabs for several files, a refresh, and keeps the editor-opening behaviour. It reuses the existing source route (whole file, range, size cap, plain refusals).
- **Files Panel needs one new read-only core route** that returns the folder hierarchy of the open Project: folders and files, with a flag for files whose language aidea can analyse, skipping version-control data, dependency folders, caches and build output by default (the existing skip-directories rule is the model). It reads the Project and never writes to it. It works for a folder in any language.
- **Selection is shared.** There is one "selected file" and one "selected Node" for the session. Choosing a file in Files selects its Node when one exists; choosing a Node (or a Flow step) selects its file and lines. Panels subscribe to the selection; they do not call each other.
- **Node sign.** When the Code Panel shows the file or lines of a Node on the Canvas, that Node shows a visible sign. The exact effect is undecided: the implementer proposes three small options (for example a glow ring, a marker beside the Node, a brief pulse then a steady outline), the person chooses, and the choice is recorded as a DECISION. The sign must follow the interface style rules for sizes and colours.
- **Renames.** The layer id and its tab become `flow`; the panel with the test data and Playback becomes Run. The route that serves the flowchart follows the layer name. User-facing text, the Tutor's layer help, the Legend and the glossary use the new words. Old words in user-facing text fail a test.
- **Dockable layout and ADR 0003.** ADR 0003 says plain JavaScript is a decision for the first version and names resizable, foldable panels as the case where adopting a framework is the expected next step. This spec needs a docking engine. The first step of slice 3 is a short decision: build docking in plain code, or adopt a docking library, judged on smoothness, size and the ADR's own criterion. The outcome is recorded as a new ADR that supersedes or amends 0003. This spec does not decide it.
- **Second monitor.** A Panel moved to another monitor lives in a second window of the same aidea session, talking to the same core, receiving the same selection and Playback events. Closing that window returns its Panels to the main one. The existing display-selection setting used for live tests is the starting point.
- **Playback records structured values.** Today each visit records its local variables as text. Data needs the values with their shape. The Playback recording gains, per visit and per variable, a structured value: kind (number, text, boolean, none, list, mapping, object with fields, reference to another value already described, or "opaque" with a label), contents up to a size and depth limit, a note of how much was cut, and a stable identity so the same object seen from two variables can be recognised. The existing text form stays, so Run, the trace table and the Tutor keep working unchanged.
- **Change detection.** The recording marks what changed between a visit and the previous one, so the interface does not have to diff large values.
- **Spike before the Data layer.** A short, throwaway investigation answers: which languages can record structured values with their adapter today (Python and TypeScript/JavaScript), how identity of objects can be obtained in each, what the cost is for large values, and what the Playback guards allow. Its verdict is folded into the Data tickets. If a language cannot, Data says so plainly (story 67).
- **Data drawing is generic.** Because aidea runs the person's own code, there is no per-algorithm animation. Rendering rules go from the shape of the value: list as cells, mapping as key-value nodes, linked objects as a graph, tree-shaped data as a tree, repeated references as one drawing with several arrows. The same drawing rules also apply to a literal value pasted or opened on its own, in the spirit of jsoncrack.com, as a later extension (see Out of Scope).
- **Data in step with Flow and Run.** There is one Playback position. Flow, Data, Run and the trace table all read it. Stepping back and changing speed are Playback controls shown in Run, with keyboard shortcuts.
- **Examples of input.** Run's suggested examples gain named kinds for numeric lists (empty, random, sorted, nearly sorted, many duplicates).
- **Layer help for Data** is added to the structure that the Tutor and the quick tour both read, with the same fields as other layers (what it is, guiding question, example, order, elements). A test keeps the interface copy and the structure equal, as it does for Business.
- **Every layer stays drawn from the code** (Data is derived: nobody writes it; the Tutor makes no proposals on it), in line with the rule that code is the source of truth for derived layers.
- **Safety.** Nothing in this spec lets aidea write to a Project because it was browsed or watched. Two named folders (the person's real projects used to try aidea) must be opened read-only and compared with `git status` before and after.

## Testing Decisions

- **One seam: the core HTTP protocol**, as in the rest of the project. A good test calls the protocol and checks what comes back or what is stored; it does not look at how the code is organised inside.
- **Names:** layer help and layer list return the new ids and words; a language-neutrality-style test fails on old words in user-facing text. Prior art: the language-neutral text test, the legend check and the layer-class tests.
- **Files route:** a fixture folder with nested folders, an ignored folder, a non-text file and an unsupported language returns the expected hierarchy, flags and skips, and writes nothing. Prior art: the skip-directories test and the project-languages test.
- **Source route (Code Panel):** already covered by the source-route tests; extend for any new refusal.
- **Layouts and Presets:** save, list, rename, delete, built-ins cannot be deleted, reset, survive a restart of the core, isolated by the preferences-file setting. Prior art: the recents test and the preferences handling.
- **Structured values:** run fixture functions that build a list, a dictionary, linked objects with a cycle, a tree, an aliased object and a huge list; check the recorded kinds, the contents, the cut note, identities, the change marks and that the text form is unchanged. Prior art: the playback and playback-examples tests.
- **Selection links** (file to Node, Node to lines): the pairing data is derived from existing routes, so the test is that the routes return it; the visible sign and dragging are verified live.
- **Live verification, not tests:** docking, dragging, smoothness, second monitor, the Node sign and the drawings of Data are checked by driving the real app on the second monitor at several window sizes (wide, 1280, narrow), against the interface style rules, with isolated recents, preferences and Learner files. Results are written in the ticket as they were measured.
- **Strict TDD:** each ticket starts with a failing protocol test for its behaviour.

## Out of Scope

- Deciding the docking engine here (it gets its own decision and ADR at the start of slice 3).
- Dropping a pasted or opened JSON, YAML, CSV or XML file onto Data as a standalone viewer (jsoncrack.com's main use). Noted as a later extension.
- Hand-written animations per classic algorithm (sorting, graph search) in the style of visualgo.net.
- A visual debugger with breakpoints and editing of running state (mentioned by the person as a later item).
- Editing code inside the Code Panel (the Code Panel reads; editing stays in the person's editor and the Builder).
- Running TypeScript or JavaScript code in Playback (blocked on the person's security decision, tracked in the language-adapters work).
- Extra layers for performance, teamwork or animation engines (see the future ideas file).
- Mobile or touch Layouts.
- The person's backlog of projects (TUIs, VPN, converters, Office clones and others): they show the range aidea must serve, they are not features of this spec.
- The earlier ticket about the clipped layer bar and the "View code" placement: superseded by slice 2.

## Further Notes

- Decisions behind this spec are in memory under the topics for the IDE direction, the dockable layout (and its names) and the Data layer. They should be repeated as DECISION lines in the overnight log when the first ticket starts.
- The person's direction, in their words: aidea should feel like an environment where a vibe-coder and a seasoned engineer are both at home; not to move away from code, but to make it accessible, with the benefits of a conventional IDE adapted to a time when software is produced constantly and learning must not stop. aidea must serve varied projects: websites, games (Unity), fullstack, neural networks, machine learning, simulations, a configuration folder.
- Real Projects to try it on, read-only: the two folders named in the handoff. Opening them is allowed; writing to them is not.
- Slice 4 is the largest and the least certain; the spike exists so it is not promised before it is known to be possible.
- Reference sites, as studied: visualgo.net (structure as protagonist, operation menu, timeline controls, status and code-trace panels, lecture mode) and jsoncrack.com (data to interactive graph or tree, side-by-side text, export, local processing). Their drawing details were not verified from text alone; open them in a browser when designing the Data drawings.
