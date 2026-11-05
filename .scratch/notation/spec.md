# Notation: layers that read like the diagrams engineers know

Status: built (audit 2026-11-04: see the ticket headers)

## Problem Statement

aidea shows six layers on one Canvas, but most of them are drawn as generic cards and rows. A person who knows how a flowchart, a class diagram, an architecture diagram or a business model canvas is supposed to read cannot find what they look for:

- Algorithm graph: every step is a rectangle; a decision has no diamond; input and output, exceptions and loops look like any other step.
- Components: an indented outline, not boxes with attributes and methods, and no arrows between modules.
- Architecture: cards with a tree line; no labelled relationships, no description, no kind of element, containment is a line instead of a boundary.
- Business: the nine blocks are loose cards in a grid, so the famous arrangement of the canvas is lost.
- Requirements: one kind of card; the distinction between what the system does and how well it must do it, taught in every software engineering course, is missing.
- The Canvas is still. Data, calls and requests do not visibly move through the diagrams, which is how a person sees order and flow at a glance.

The person's goals for the first version: fill the gaps their university left, make the app feel like a university class, give engineers a technical result they trust, move fast, and have no legal problems.

## Solution

Every layer follows the notation engineers already know for that kind of diagram, drawn in aidea's own visual style (our colours, type and cards). The visual reference is the approved prototype `.scratch/notation/prototype/index-hover-tilt.html`; the research notes in `.scratch/notation/research/` hold the sources.

- **Algorithms**: a flowchart (terminators, process boxes, decision diamonds with labelled exits, a parallelogram for input and output, a loop with a way back, a dashed red path for exceptions). Playback runs a token through it.
- **Components**: UML-style packages and classes (three compartments, visibility, inheritance, dependencies), with every relationship carrying a Resolution (resolved, inferred, unresolved).
- **Architecture**: C4-style elements (kind, name, technology, description), boundaries that enclose what they contain, and labelled one-way relationships.
- **Business**: the nine blocks of the business model canvas in their canonical arrangement, each Node a sticky note inside its block, with the canvas's credit line.
- **Requirements**: functional and non-functional requirements told apart, with acceptance criteria. (Proposed; see Implementation Decisions.)
- **Motion** on all five diagram layers: arrows flow in their direction, important elements breathe, and data, messages and requests travel along the lines as small glowing packets.
- **Legend**: each layer has a "?" button that explains its notation and says what the layer does not show.

Nothing that exists in the code is silently left out: what the notation cannot draw appears as a generic labelled element.

## User Stories

1. As an engineer, I want the Algorithm graph to use flowchart symbols (start and end, process, decision, input and output), so that I read it without learning anything new.
2. As an engineer, I want a decision drawn as a diamond with labelled exits (Yes and No; a pattern per exit for a `match`), so that I can follow each branch.
3. As an engineer, I want a loop drawn as a decision with a plain arrow going back up, labelled with how it exits, so that I see where the repetition happens.
4. As an engineer, I want calls that read or write outside the program (`print`, `input`, `open`, network calls) drawn as input and output symbols, so that I see where the function touches the world.
5. As an engineer, I want `try`/`except` shown as a dashed red path labelled with the exception type, so that I can see error handling at a glance.
6. As an engineer, I want `return` and `raise` as distinct terminators (`raise` tinted red), so that I see how a function ends.
7. As an engineer, I want `break`, `continue`, `with` and `finally` to be visible in the flow, so that Python-specific control flow is not hidden.
8. As a person, I want any construct that has no flowchart symbol to appear as a generic step saying what it is, so that nothing is silently missing.
9. As a person, I want a Playback token to travel through the flowchart along the path of the real recording, so that I see the order the code really ran in.
10. As an engineer, I want Components drawn as packages containing class boxes with name, attributes and methods, so that I read it as a class diagram.
11. As an engineer, I want visibility marks (`+`, `-`, `#`) on attributes and methods, derived from Python naming and labelled as derived, so that I see what is public.
12. As an engineer, I want inheritance drawn with a hollow triangle and abstract classes in italics, so that the hierarchy reads as UML.
13. As an engineer, I want module dependencies drawn as dashed arrows labelled `import`, so that I see how packages depend on each other.
14. As an engineer, I want calls between functions and classes drawn as arrows, so that I see who uses whom.
15. As a person, I want every derived relationship to carry a Resolution, and a relationship that could not be resolved to be drawn grey, dashed, marked "?" and still, so that nothing uncertain looks certain.
16. As a person, I want the legend of a derived layer to say how many relationships are unresolved and why, so that I know the limits of the diagram.
17. As an engineer, I want Architecture elements to have a kind (person, system, container, component), a name, a technology and a short description, so that I read them as C4 elements.
18. As an engineer, I want an element contained in another to be drawn inside the container's boundary, so that containment is not confused with use.
19. As an engineer, I want relationships between elements drawn as one-way arrows with a label and, when known, a technology, so that I see what talks to what and how.
20. As a person, I want external systems and people drawn outside the boundary, so that the scope is clear.
21. As a person, I want a Proposal on the Architecture layer drawn with a dashed accent outline and a PROPOSAL tag, so that I can tell it from accepted elements.
22. As a person, I want the builder to be able to propose the new fields (kind, description, relationships), so that it fills them in through Proposals I accept or reject.
23. As a person, I want old project files without the new fields to keep working, so that nothing breaks.
24. As a business person, I want the Business layer drawn as the nine-block canvas in its canonical arrangement, so that I recognise it at once.
25. As a person, I want each Business Node to be a sticky note inside its block, and empty blocks to stay visible, so that gaps in the model are obvious.
26. As a person, I want sticky notes straight by default and tilting slightly, lifted and opaque, when the cursor is over them, with an angle that never lets a wide note overlap its neighbours, so that the canvas feels alive without clutter.
27. As the project owner, I want the Business layer to show the canvas's credit and licence line, so that the licence is respected.
28. As a person, I want Requirements told apart as functional (what the system does) and non-functional (how well, under which limits), so that I learn and use the distinction. (Proposed.)
29. As a person, I want a non-functional requirement to name its quality (for example performance, security, usability, reliability, maintainability, compatibility, portability, safety) and to be measurable, so that it can be checked. (Proposed.)
30. As a person, I want a functional requirement to read "As a…, I want…, so that…" with acceptance criteria written Given/When/Then, so that I know when it is done.
31. As a person, I want to see which Architecture elements and which code satisfy a requirement, through the trace links that already exist, so that a decision can be traced back to a need. (Proposed for NFRs: the Rationale of an element can cite the quality it serves.)
32. As a person, I want arrows on every diagram layer to flow in their direction, so that I see direction without reading arrowheads.
33. As a person, I want data, messages and requests to appear as small glowing packets travelling along the lines from source to target, so that I see flow.
34. As a person, I want important or active elements to glow brighter and dimmer in a slow loop, so that I see what is alive.
35. As a person, I want hovering or focusing an element to light its incoming and outgoing paths, so that I can follow a connection.
36. As a person, I want one colour to mean one thing on every layer (accent: active or in flight; teal: visited or derived; amber: authored; red: error or exception; grey dashed: unresolved or inferred), so that colour is learnable.
37. As a person, I want a global switch to turn animations off, and the system's "reduce motion" setting respected, so that motion never gets in the way.
38. As a person, I want animations to pause when the window is hidden, so that they cost nothing in the background.
39. As a person, I want a "?" button on each layer that opens its legend (shapes, arrows, colours) and says what the layer does not show, so that I know how to read it and where it stops.
40. As a person, I want the layout of a diagram to be identical every time for the same input, so that I can learn where things are.
41. As a person, I want the layout to avoid overlaps and keep crossings low, so that diagrams stay readable.
42. As a person, I want the Tutor, Proposals, permission cards and Playback to keep working in the new drawings, so that nothing already built regresses.

## Implementation Decisions

- **Principle.** aidea's look is ours; the grammar of each layer (shapes, meaning of arrows, arrangement) comes from the notation engineers know. A standard's name appears in the interface and docs only as "-style" (flowchart notation, UML-style, C4-style); aidea never claims to comply with a standard.
- **Legal.** All artwork and text are drawn fresh; no copied images or text from standards or vendors. The Business canvas shows: "Business Model Canvas by Strategyzer AG, licensed CC BY-SA 3.0. Layout adapted for aidea." with the licence link; the adapted canvas drawing carries the same licence. Fonts keep their bundled licences.
- **Algorithm graph.** Step kinds map to symbols: start and end to stadium terminators; step to process rectangle; branch (`if`, `match`) to decision diamond with labelled exits; loop to a decision with exits (`for`: next item or done; `while`: yes or no) and a plain upward arrow back; return to a terminator, raise to a red-tinted terminator; calls to a known set of input and output functions (the same list Playback already treats as external effects, plus `print` and `input`) to a parallelogram; `try`/`except` to a dashed red edge labelled with the exception type to the handler; `with`, `break`, `continue`, `finally` stay as steps or edges that the extractor already produces and are drawn distinctly; anything else is a generic step labelled with the construct. The extractor already models `with`, `try`/`except`/`finally`, `break`, `continue`.
- **Components.** Modules become packages (a box with a tab), classes become boxes with three compartments, module-level functions become small function boxes inside their package. Visibility comes from Python naming (leading underscore means private, double underscore and trailing double underscore are marked as special) and is labelled as derived in the legend, since it is not part of the notation. Static members are underlined, abstract classes italic. Inheritance is a hollow triangle, import dependency a dashed open arrow labelled `import`, a call a plain arrow. Composition and aggregation are not inferred in this version (too many false positives).
- **Resolution.** Every derived relationship carries one of resolved, inferred (from names), unresolved. Resolved is solid; inferred is dashed; unresolved is grey, dashed, marked "?" and never animated. The core reports the Resolution with each relationship; the legend counts the unresolved. A relationship is never drawn as certain when it is not.
- **Architecture data.** Architecture Nodes gain optional `kind` (person, system, container, component), `description` (a short sentence) and `relations` (a list of `{to, label, technology?}` naming other Nodes of the layer). `parent` now means "is inside". A relation to a missing Node is dropped with an error, like other bad data; cycles in `parent` stay ignored. The builder's Proposals can set the new fields. Files without them load as before. This replaces the parent connector line of ticket 13 with a boundary around children and arrows for relations.
- **Architecture drawing.** A Node with children is drawn as a dashed boundary with a title (`name [kind]`) enclosing them; a leaf is a box with name, `[kind: technology]` and description; relationships are one-way labelled arrows. Boundaries are a convention of C4 tooling, not required by the C4 authors; the legend says so.
- **Business.** The nine blocks keep their names; the arrangement is: Key Partners, Key Activities over Key Resources, Value Propositions, Customer Relationships over Channels, Customer Segments, with Cost Structure and Revenue Streams across the bottom. Each Node is a sticky note in its block. Notes are straight by default; on hover a note lifts, becomes opaque and tilts by an angle that shrinks with its width (about 3 px at the ends, at most 1.8 degrees) so it never overlaps a neighbour; reduced motion disables the tilt.
- **Requirements (proposed, awaiting the person's confirmation).** Requirements Nodes gain `kind` (functional or non-functional, default functional). A functional requirement keeps `as`, `want`, `so` and gains optional `criteria` (Given/When/Then lines). A non-functional requirement has a `statement`, a `quality` (a short list of common qualities written in our own words, not copied from a standard) and a measurable `measure`; `as`, `want`, `so` are not required for it. The layer shows the two kinds in two groups. A Rationale of an Architecture Node may cite the non-functional requirement it serves through a trace link. No "no implementation" warning is added (a new requirement legitimately has none; a requirement that lost its implementation is the Tutor's question of ticket 16).
- **Motion.** All motion is CSS or SVG, always on by default and cheap: dashes flowing along edges in their direction; a slow breathing glow (about 2.5 s) on active or important elements; small glowing packets travelling source to target along the edges in a loop, in a colour with a stable meaning; hover and focus light the paths of an element. One colour has one meaning across layers. A global "Animations: on/off" control exists; `prefers-reduced-motion` starts with animations off; animations pause while the window is hidden. Unresolved relationships do not move. A "pause and step" mode that freezes the loop and advances one hop at a time is available, and prediction questions belong to the Tutor, off by default.
- **Legend.** Each layer's Canvas card has a "?" button opening a popover: shapes, arrows, colours, and an explicit "not shown" list. The popover is closed by default.
- **Layout.** The core computes positions and the interface only draws what it is given (as today). A small layered layout, deterministic and dependency-free, is written in the core: nodes ordered by id, no randomness, ranks from edge direction, a way back for loops, orthogonal routes with small elbows, one level of enclosing boundaries. The first user is the flowchart, then Architecture; Business uses a fixed grid; Components uses packages in columns with classes stacked. Same input gives the same output.
- **Fallback.** Whatever the notation cannot draw is shown as a generic labelled element, never omitted. Each legend states what a layer covers and what it leaves out.
- **Reference.** The look, spacing and motion of the approved prototype are the target; the implementer compares screenshots with it (see Testing Decisions).

## Testing Decisions

- **Good test:** only external behaviour through the core's HTTP protocol, as in every ticket so far (the test helpers start a core and copy fixtures).
- **Through the protocol:** layout results are deterministic (the same project twice gives identical rectangles and routes) and free of overlaps; Business blocks land in the canonical arrangement and an empty block is still present; Architecture children are inside their boundary and relations are validated (missing target dropped with an error, old files unchanged); the new fields are accepted and refused correctly, including in Proposals; flow steps carry the data needed to choose a symbol (kind, labelled exits, input and output flag, exception edges); Components relationships carry a Resolution and unresolved ones are counted; the requirement kinds validate (a non-functional requirement without `as`, `want`, `so` is valid).
- **Not tested automatically:** drawing, motion, legend popovers and the sticky-note tilt. They are verified with a headless browser (no visible window): screenshots read next to the prototype, differences listed in each ticket's review notes, and for motion the positions of packets sampled at two moments.
- **Prior art:** the existing core-protocol tests for layers, layout, proposals and playback.

## Out of Scope

- Claiming compliance with ISO, UML or C4; the full standards.
- Sequence, state, deployment and use-case diagrams; C4 levels as separate diagrams (one Canvas with zoom stays).
- Inferring composition and aggregation.
- Story maps, MoSCoW priorities and a full traceability matrix.
- Creating or arranging Nodes by hand on the Canvas.
- Exporting diagrams.
- Languages other than Python.
- A library for layout or animation.

## Further Notes

- Research and sources: `.scratch/notation/research/01..04`. Gaps they report: ISO 5807 and ISO/IEC/IEEE 29148 are paywalled (symbol sets were read from secondary sources); the C4 site does not define the boundary notation; whether adapting the canvas layout is a derivative work was not settled by the owner of the question, so full CC BY-SA compliance is the chosen safe path.
- Evidence note: the pedagogy literature found that passive animation shows weak gains; ambient motion here is meant to show direction and state, and the interactive learning (predicting, stepping) belongs to the Tutor.
- Visual reference: `.scratch/notation/prototype/index-hover-tilt.html` (the original `index.html` has fixed tilts of the notes that are not carried over).
- Vocabulary: Notation, Legend, Relationship, Resolution, Algorithm graph, Footprint are in `GLOSSARY.md`.
