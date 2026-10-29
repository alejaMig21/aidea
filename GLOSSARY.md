# aidea

A desktop workspace where a person builds software on a zoomable canvas of stacked layers, from business model down to code, working with an AI agent or by hand, while a tutor builds their understanding of every decision.

## Canvas and layers

**Canvas**:
The single zoomable, pannable surface where all layers of a project are shown as nodes and connections.
_Avoid_: Whiteboard, diagram, board

**Layer**:
One level of abstraction of a project (business, requirements, architecture, components and data, algorithms, code) that becomes visible at a given zoom depth.
_Avoid_: Level, tier, view

**Lens**:
Information laid over a layer that already exists, such as a measurement of cost on the Components and Algorithms layers, without becoming a layer of its own or changing the stack of layers.
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

**Algorithm graph**:
The flowchart of one function: its steps, decisions and loops drawn with the notation engineers know for flowcharts, so that Playback can animate it.
_Avoid_: UML diagram

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

**Functional requirement**:
A requirement that says what the system does for someone, written as "As a..., I want..., so that..." and optionally checked by acceptance criteria written Given/When/Then.
_Avoid_: Feature, user story (the story is its wording, not the kind)

**Non-functional requirement**:
A requirement that says how well the system must do something, naming a quality (such as performance or security) and a measure that can be checked.
_Avoid_: Constraint, quality attribute

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
The part of aidea that makes sure the person understands what they build. It measures what they know, plans what they must understand for this project, teaches the reasons behind decisions by asking them to predict before revealing, and helps them write each authored layer in their own words. It can read the project and propose changes to the authored layers as Proposals, never edits code, and keeps the Learner graph of what the person has demonstrated.
_Avoid_: Assistant, coach, explainer

**Contract**:
What the person has accepted on the Business, Requirements and Architecture layers. The builder reads it before building and may not depart from it except through a Proposal the person accepts; aidea compares what was built with it and shows the differences.
_Avoid_: Spec, brief

**Plan**:
The Tutor's map for one project: the concepts the person must understand, in the order they depend on each other, and the decisions still open on each layer. The person sees it and asks for changes; the Tutor asks questions only about what is in it.
_Avoid_: Curriculum, roadmap

**Evidence**:
The record of each answer the person gave in a class: whether it was right, how sure they were and what they thought. It is kept apart from the Learner graph, which holds only ideas the Tutor taught.
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
A separate session of generated problems, based on the user's own project, that checks recall of propositions without naming them. Planned for a later version; the Learner graph is designed so that it can be added.
_Avoid_: Quiz, exercise

## Window

**Column**:
A vertical area of the window that the person can resize or fold away. The work session arranges the chat, the Canvas and a right slot, which holds the Tutor column and the Algorithm column as tabs. Folded columns take no space, and in narrow windows the chat and the right slot open as drawers over the Canvas.
_Avoid_: Sidebar, panel, pane

**Tutor column**:
The column that belongs to the Tutor: explanations, questions and class mode. It holds nothing else.

**Algorithm column**:
The column for everything about the algorithms layer: the form for the data of a test and the Playback. Its tab is always in the right slot and is enabled only while an algorithm is open.
