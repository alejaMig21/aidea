# aidea

A desktop workspace where a person builds software on a zoomable canvas of stacked layers, from business model down to code, working with an AI agent or by hand, while a tutor builds their understanding of every decision.

## Canvas and layers

**Canvas**:
The single zoomable, pannable surface where all layers of a project are shown as nodes and connections.
_Avoid_: Whiteboard, diagram, board

**Layer**:
One level of abstraction of a project (business, requirements, architecture, components and data, flow) that becomes visible at a given zoom depth.
_Avoid_: Level, tier, view

**Lens**:
Information laid over a layer that already exists, such as a measurement of cost on the Components and Flow layers, without becoming a layer of its own or changing the stack of layers.
_Avoid_: Overlay layer, mode

**Authored layer**:
A layer whose content is written by a person or the agent and stored as the project's own record, because it cannot be recovered from code.
_Avoid_: Manual layer, high layer

**Derived layer**:
A layer computed from the project's code each time it is needed, so it can never drift from the code.
_Avoid_: Generated layer, low layer

**Node**:
One element on a layer, carrying a rationale for why it exists.
_Avoid_: Box, block

**Rationale**:
The written reasons behind a node, including the alternatives that were rejected.
_Avoid_: Explanation, notes

**Pattern group**:
A named set of nodes on the architecture layer that together realise an architectural pattern, with each node labelled by its role in it.
_Avoid_: Template, blueprint

**Flow**:
The flowchart of one function: its steps, decisions and loops drawn with the notation engineers know for flowcharts, so that Playback can animate it. Also the name of the layer that draws it.
_Avoid_: Algorithm graph, Algorithms (as a layer name), UML diagram

**Notation**:
The shapes and arrows a layer draws with, and what each of them means. Every layer follows the notation engineers already know for that kind of diagram, in aidea's own visual style, and says in its legend what it covers and what it leaves out.
_Avoid_: Style, theme

**Legend**:
The small explanation of a layer's notation, opened from the layer's Canvas card. It also says what the layer cannot show.
_Avoid_: Key, help

**Relationship**:
A labelled arrow between two nodes of the same layer meaning that one uses or depends on the other. It is different from a trace link, which joins layers.
_Avoid_: Connection, wire

**Resolution**:
How sure a derived layer is about a relationship it drew: resolved, inferred from names, or unresolved because the code is too dynamic to tell. A relationship is never drawn as certain when it is not.
_Avoid_: Confidence, accuracy

**Playback**:
An animated run of a Flow showing which step is active and how values change.
_Avoid_: Simulation, debug view

**Recording**:
The saved record of one real run of a function: the steps it went through and the values on arrival at each. Playback replays it and never runs the code again.
_Avoid_: Trace, log, simulation

**Footprint**:
The region of the next layer down that a node is realised by, which the canvas centers on when the user zooms into that node.
_Avoid_: Children, scope

**Trace link**:
A connection from a node on an authored layer to the nodes or code it is realised by, letting the user zoom between layers.
_Avoid_: Reference, relation

**Broken link**:
A trace link whose target no longer exists in the code.
_Avoid_: Stale link, dead link

**Functional requirement**:
A requirement that says what the system does for someone, written as "As a..., I want..., so that..." and optionally checked by acceptance criteria written Given/When/Then.
_Avoid_: Feature, user story (the story is its wording, not the kind)

**Non-functional requirement**:
A requirement that says how well the system must do something, naming a quality (such as performance or security) and a measure that can be checked.
_Avoid_: Constraint, quality attribute

## Working with agents

**Agent adapter**:
The plugin that lets aidea drive one specific external coding agent. It fills the role of Provider.
_Avoid_: driver, connector

**Proposal**:
A change the agent suggests to the canvas or code, shown highlighted and pending until the user accepts or rejects it.
_Avoid_: Suggestion, draft

**Permission mode**:
The setting that decides how much the builder may do without asking the person, such as manual, accept edits, plan or auto. It is different from Class mode and Direct mode, which are about the Tutor.
_Avoid_: Agent mode, approval level

**Permission card**:
A card in the chat bar asking the person to approve or reject one action the agent wants to take, shown with what the action would do.
_Avoid_: Prompt, confirmation, dialog

## Learning

**Tutor**:
The part of aidea that makes sure the person understands what they build. It measures what they know, plans what they must understand for this project, teaches the reasons behind decisions by asking them to predict before revealing, and helps them write each authored layer in their own words. It can read the project and propose changes to the authored layers as Proposals, never edits code, and keeps the Learner graph of what the person has demonstrated.
_Avoid_: Assistant, coach, explainer

**Contract**:
What the person has accepted on the Business, Requirements and Architecture layers. The builder reads it before building and may not depart from it except through a Proposal the person accepts; aidea compares what was built with it and shows the differences.
_Avoid_: Spec, brief

**Plan**:
The Tutor's map for one project: the concepts the person must understand, in the order they depend on each other, and the decisions still open on each layer. The person sees it and asks for changes; the Tutor asks questions only about what is in it.
_Avoid_: Curriculum, roadmap

**Evidence**:
The record of each answer the person gave in a class: whether it was right, how sure they were and what they thought. It is kept apart from the Learner graph, which holds only ideas the Tutor taught. A guess made before a step of a Recording ("Guess first" in Playback) is Evidence too, about that run.
_Avoid_: Score, grade

**Review question**:
One question, with no hint, at the start of a free class (one started with "Start a class", not one on a layer, on selected text, on a difference or on a decision) about an idea the person met in an earlier class of the same Project, the one not asked about for the longest time; a Project with no ideas of its own uses any earlier idea. An idea the class topic names is never chosen. The person may say they do not know, and may turn it off; the answer is Evidence and never changes the Learner graph.
_Avoid_: Quiz, test

**Decision class**:
A short class in Class mode that stops the builder at one Blocking decision until the person has answered.
_Avoid_: Quiz

**Layer class**:
A longer class, started from a layer's "Teach me through it" button, in which the Tutor builds that layer with the person, asking first and turning their answers into Proposals. Until the Tutor is available the button runs a fixed quick tour.
_Avoid_: Tutorial, wizard

**Guide class**:
A class about aidea itself, started from the "How aidea works" button in the top bar. The Tutor teaches the parts of the app in order from one structure in the core (`guide.ts`), asking the person to try each part in the real interface; it is not part of the Project's Plan. Until the Tutor is available the button runs a fixed quick tour of the same content.
_Avoid_: Onboarding, tutorial

**Class mode**:
A setting in which the tutor interrupts the agent on decisions so the user must predict first.
_Avoid_: Learning mode

**Direct mode**:
A setting in which the agent works without tutor interruptions; the user can still ask to learn on demand.
_Avoid_: Fast mode

**Blocking decision**:
A decision on an authored layer that the agent may not commit until the user has answered the tutor.
_Avoid_: Gate, checkpoint

**Project**:
A code repository opened in aidea together with the authored layers kept inside it.
_Avoid_: Workspace, app

**Recent project**:
A Project the person opened before, remembered by its folder path outside any Project so it can be opened again from Home. Forgetting one removes only the entry, never the folder.
_Avoid_: History, bookmark, favourite

**Home**:
The screen shown when no Project is open. It lists the Recent projects and explains how to start when there are none.
_Avoid_: Start page, dashboard, launcher

**Probe**:
The tutor's short assessment (at most five questions) of what the user already understands, given before the first class of each layer and skipping what the Learner graph already shows.
_Avoid_: Entrance exam, placement test

**Learner graph**:
The record of what this user has demonstrated they understand, kept as linked propositions and separate from any project.
_Avoid_: Profile, skill tree

**Proposition**:
A single claim the user has shown they understand, such as "reservations need transactions".
_Avoid_: Fact, note

**Reasoning chain**:
A set of propositions that together lead to a conclusion.
_Avoid_: Argument, path

**Practice session**:
A separate session of generated problems, based on the user's own project, that checks recall of propositions without naming them. Planned for a later version; the Learner graph is designed so that it can be added.
_Avoid_: Quiz, exercise

## Plugins

**Kernel**:
The small part of aidea that is not a plugin and works with every plugin off: the plugin loader and registry, the plugin manager, the window with the Layout and its named slots, the point that decides on guard rules, configuration, credentials and the core server, and the emergency screen. Everything else is a plugin.
_Avoid_: Core (the core server is only one part of it), Engine, Platform

**Plugin**:
A folder of finished JavaScript and a manifest that adds something to aidea through the public API: a Panel, a layer, a language, an agent connection, a tool, a guard rule, the Tutor. The features that ship with aidea are plugins too, removable except the few marked required. See `docs/plugin-api.md`.
_Avoid_: Extension, add-on, module, mod

**Quarantine**:
The folder where a plugin that was just added waits. Nothing of it runs there. It is scanned without a model, the Tutor may give an opinion, and only the person installs it from there; every update returns to it.
_Avoid_: Sandbox, staging

**Role**:
A job that plugins fill for the rest of aidea, such as being the Tutor or being a Builder. A role needs at least one Instance.
_Avoid_: Service type, persona

**Instance**:
One running copy of a role, such as one Tutor or one Builder, with its own session. A goal for later: the person can have several of a role at once, each connected to its own Provider.
_Avoid_: Agent (it names the Provider), Session (an Instance owns one)

**Provider**:
The plugin that connects an Instance to a concrete agent or model, such as one for Claude Code. It is what an Agent adapter is.
_Avoid_: Backend, vendor

## Window

**Panel**:
One section of the window with one job that the person can show, hide, resize and move (side by side, stacked, nested or grouped as tabs): the Builder (chat), the Canvas, the Tutor, Playback, Files and Code. A Panel is never a layer: a layer is something the Canvas draws. Every Panel is declared once in a registry, and the top bar has a single "Panels" menu that lists all of them with a check mark and shows or hides each one: a new Panel adds a row to that menu, never a button to the top bar. Hidden Panels take no space, and in narrow windows the side Panels open as drawers over the Canvas.
_Avoid_: Column, sidebar, pane, tab (as the name of a Panel)

**Layout**:
How all the Panels are arranged on the screen right now: which are shown, their sizes and places (side by side, stacked, nested or grouped as tabs) and, later, their monitors. The default Layout is the Builder, the Canvas and the Tutor in one row.
_Avoid_: Workspace, view

**Preset**:
A Layout saved with a name, to return to it in one click. Some come with aidea and cannot be deleted.
_Avoid_: Profile, theme

**Playback panel**:
The Panel for playing back one function: the form for the data of a test and the Playback itself. It is a card of its own between the Canvas and the Tutor, never part of the Tutor's: it appears while a Flow is open, and the person can hide it like any other Panel. Its internal id stays `run` so that a saved Layout keeps working.
_Avoid_: Run panel, Algorithm column, Algorithm panel

**Run**:
Starting every program of the Project, in the right order, from the Project's run recipe, with the Play control in the top bar (the Run plugin). It is different from Playback, which animates one function.
_Avoid_: Playback (that is one function), Start all, Launch

**Files**:
The Panel that shows the folders and files of the Project as a tree, read-only, and works on any folder whatever its language. It starts hidden. A file in a language aidea can read says which. Folders that hold dependencies, caches, build output or version-control data are listed as ignored and are not opened; a folder or a Project with too many entries lists the first ones and says how many it left out.
_Avoid_: Explorer, file browser, sidebar

**Code**:
The Panel that shows the whole text of files with line numbers and syntax colours, read-only, one tab per open file. A file is chosen in Files; the code of a Node or of a Flow step is opened from the Details ("View code") or by double-clicking the step, and its lines are highlighted. It is a Panel, not a layer: the Layer bar lists only what the Canvas draws. "Open in my editor" works for the file of the tab shown. It starts hidden and opens by itself when something is chosen.
_Avoid_: Code layer, code view, editor

**Run recipe**:
The file `.aidea/run.json` that lists the parts Play starts. aidea runs nothing from a recipe the person has not accepted on this machine: it shows the whole recipe the first time and only what changed afterwards.
_Avoid_: Run config, launch file

**Part**:
One program of a run recipe: a name, a command, a folder, the parts it waits for and a ready signal. Each part has its own tab in the Terminal.
_Avoid_: Service, process

**Ready signal**:
The real check that a part is up so the next one may start: a port that answers, a line it prints, a file that appears, or a URL that answers.
_Avoid_: Health check

**Shape**:
The recorded form of a value during Playback: not only its text but what kind it is (a number, a list, a mapping, an object with fields, a reference to something already described), what it holds up to a limit, how much was left out, a number that tells whether two names are the same object, and whether it changed since the previous step. It is what the Data layer will draw. Today only Python records it.
_Avoid_: Snapshot, dump
