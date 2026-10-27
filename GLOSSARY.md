# aidea

A desktop workspace where a person builds software on a zoomable canvas of stacked layers, from business model down to code, working with an AI agent or by hand, while a tutor builds their understanding of every decision.

## Canvas and layers

**Canvas**:
The single zoomable, pannable surface where all layers of a project are shown as nodes and connections.
_Avoid_: Whiteboard, diagram, board

**Layer**:
One level of abstraction of a project (business, requirements, architecture, components and data, algorithms, code) that becomes visible at a given zoom depth.
_Avoid_: Level, tier, view

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

**Algorithm graph**:
The node-and-wire depiction of one function's steps, branches and data flow, shown instead of a UML box.
_Avoid_: Flowchart, UML diagram

**Playback**:
An animated run of an algorithm graph showing which step is active and how values change.
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

## Working with agents

**Agent adapter**:
The piece that lets aidea drive one specific external coding agent.
_Avoid_: Plugin, driver, connector

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
The part of aidea that teaches the user the reasons behind decisions, by asking them to predict before revealing.
_Avoid_: Assistant, coach, explainer

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
The tutor's initial assessment of what the user already understands, scoped to what a new project's goal depends on.
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
A separate session of generated problems, based on the user's own project, that checks recall of propositions without naming them.
_Avoid_: Quiz, exercise

## Window

**Column**:
A vertical area of the window that the person can resize or fold away. The window arranges the project list, the chat and the Canvas in columns, and adds two more only when they apply: the Tutor column and the Algorithm column.
_Avoid_: Sidebar, panel, pane

**Tutor column**:
The column that belongs to the Tutor: explanations, questions and class mode. It holds nothing else.

**Algorithm column**:
The column for everything about the algorithms layer: the form for the data of a test and the Playback. It appears only while an algorithm is open.
