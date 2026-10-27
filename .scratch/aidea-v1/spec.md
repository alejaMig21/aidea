Status: ready-for-agent

# aidea v1: layered canvas workspace with an AI builder and a tutor

## Problem Statement

People who build software with AI agents lose understanding of what was built and why. The agent proposes a working architecture, the person has no reason to question it, and over time their grasp of business modelling, requirements, architectural patterns and algorithms erodes. Those who reject AI altogether keep that understanding but forgo the speed. Today's agent tools are terminal or chat shaped: they show text, not the structure of the software, and they teach nothing.

The person also cannot move between levels of abstraction. The business reason for a feature, the requirement behind it, the architectural decision that shaped it, the algorithm inside it and the code that implements it live in different places, if they are written down at all.

## Solution

aidea is a desktop workspace in which a **Project** is shown on a single zoomable **Canvas** made of six stacked **Layers**: Business, Requirements, Architecture, Components and data, Algorithms, and Code. The first three are **Authored layers** written by the person or the agent and stored in the repository. The last three are **Derived layers** computed from the code, so they never drift from it. Zooming into a **Node** opens the layer below centered on that node's **Footprint**.

The person talks to an AI builder through a chat bar at the bottom. The builder is the user's own, unmodified Claude Code, driven through an **Agent adapter**. The builder changes the authored layers only through **Proposals** the person accepts or rejects. A separate **Tutor** teaches the reasons behind decisions: in **Class mode** it stops the builder at each **Blocking decision** and asks the person to predict or choose before the rationale is revealed; in **Direct mode** it stays out of the way. The person can also select any text and ask for a definition or enter the tutor. Each function can be opened as an **Algorithm graph** and watched in **Playback** from a real recorded execution. A person who prefers to code by hand can zoom to the Code layer and open the file in their own editor.

Screen layout: Projects on the left, the Canvas in the center, the Tutor panel on the right, the chat bar in the footer.

## User Stories

1. As a developer, I want to open a Python repository as a Project, so that I can see it on the Canvas.
2. As a developer, I want a list of my Projects on the left, so that I can switch between them.
3. As a developer, I want to pan and zoom freely over the Canvas, so that I can move from the overview to the detail without menus.
4. As a developer, I want the Canvas to show six named Layers, so that I always know which level of abstraction I am looking at.
5. As a developer, I want the Business layer to use the Business Model Canvas structure, so that I can describe who pays and why with a known notation.
6. As a developer, I want the Requirements layer to hold user stories as Nodes, so that I can see what the system must do.
7. As a developer, I want the Architecture layer to show the large pieces and technology choices of my system, so that I can see how it is shaped.
8. As a developer, I want each Node to carry a Rationale including rejected alternatives, so that I can learn why it exists.
9. As a developer, I want to read a Node's Rationale in the Tutor panel when I select it, so that explanations appear exactly where my attention is.
10. As a developer, I want the Architecture layer to show Pattern groups with role-labelled Nodes, so that I can see an architectural pattern as a structure and learn what each part is for.
11. As a developer, I want a Pattern group to be flagged when the derived code violates it, so that I notice when the design drifts.
12. As a developer, I want the Components and data layer computed from my code, so that it is always accurate.
13. As a developer, I want classes shown as Nodes with their members, not UML boxes, so that I can follow them as part of the same node graph as everything else.
14. As a developer, I want the Algorithms layer to show each function as an Algorithm graph, so that I can follow its steps and branches visually.
15. As a developer, I want to zoom from a class into the Algorithm graphs of its methods, so that the descent from design to logic is continuous.
16. As a developer, I want to zoom from an Algorithm graph into the code text, so that I can read the exact source.
17. As a developer, I want zooming into a Node to center the layer below on that Node's Footprint, so that I see exactly the part relevant to what I chose.
18. As a developer, I want zooming out to return me to the Node I came from, so that I never get lost.
19. As a developer, I want a Footprint spread over several places to frame all of them and dim the rest, so that I see that one requirement lives in several parts.
20. As a developer, I want Trace links from requirements and decisions to components and code, so that I can go from "why" to "where" and back.
21. As a developer, I want a Trace link whose target disappeared to be marked as a Broken link, so that I know a requirement lost its implementation.
22. As a developer, I want Derived layers to recompute when I edit code by hand, so that the Canvas stays true to the code.
23. As a developer who prefers to write code myself, I want an "open in my editor" action on the Code layer, so that I use my usual tools.
24. As a developer, I want Playback of an Algorithm graph using a real recorded execution on sample inputs, so that I see what the code actually does.
25. As a developer, I want to pause, step and scrub through a Playback, so that I can study a moment as long as I need.
26. As a developer, I want sample inputs for Playback to come from my tests or from values I type, so that I control what is run.
27. As a developer, I want Playback limited to functions without external effects, or with those effects replaced by fake data, so that running it cannot damage anything.
28. As a developer, I want to chat with the builder in a bar at the bottom, so that I direct the work in plain language.
29. As a developer, I want the builder to be my own installed Claude Code, so that my plugins, skills, hooks and memory keep working.
30. As a developer, I want to sign in with my own Claude subscription through Claude Code's normal flow, so that I need no API key.
31. As a developer, I want aidea never to read or store my Claude credentials, so that my account stays safe.
32. As a developer, I want to see which sub-agents the builder has started, so that I understand what is working on my behalf.
33. As a developer, I want the builder's changes to the authored layers to arrive as highlighted Proposals, so that I can review every change.
34. As a developer, I want to accept or reject each Proposal, so that I stay in control.
35. As a developer, I want the builder to be unable to write the authored layers except through aidea's tools, so that it cannot leave the Canvas in a broken state.
36. As a developer, I want to hand-edit the authored layer files in my repository, so that I can work without the agent.
37. As a developer, I want hand-edited authored files validated when loaded, so that mistakes are reported clearly.
38. As a developer, I want authored layers stored as text files in my repository, so that git versions them with my code.
39. As a developer, I want each permission request from the builder to appear as a card with approve and reject, so that I decide what runs.
40. As a developer, I want my existing permission rules respected so that I am only asked what they do not settle.
41. As a learner, I want a short Probe when I create a Project, limited to the concepts that Project depends on, so that the Tutor knows where to start.
42. As a learner, I want the Tutor to run as a separate session from the builder, so that teaching does not clutter the builder's context.
43. As a learner, I want the Tutor to ignore my personal plugins and instructions, so that it teaches in its own style.
44. As a learner in Class mode, I want the builder to stop at each Blocking decision until I answer the Tutor, so that I think before accepting.
45. As a learner, I want Blocking decisions limited to new or changed Nodes on the first three layers, technology choices and Pattern groups, so that I am interrupted only where it matters.
46. As a learner, I want to predict or choose among alternatives before the rationale is revealed, so that I learn by committing to an answer.
47. As a learner, I want my answers recorded as Propositions and Reasoning chains in my Learner graph, so that my understanding accumulates.
48. As a learner, I want the Tutor to skip what my Learner graph shows I already understand, so that I am not asked twice.
49. As a learner, I want to switch between Class mode and Direct mode, so that I can go fast when I choose to.
50. As a learner in Direct mode, I want to select any text and ask for a definition, so that I never face an unexplained term.
51. As a learner, I want to select any text and enter the Tutor on it, so that I can go deeper on demand.
52. As a learner, I want my Learner graph separate from any Project, so that what I learned follows me between Projects.
53. As a learner, I want Broken links and unimplemented requirements to become questions the Tutor can ask, so that I learn from what drifted.
54. As a developer, I want a clear message when Claude Code is missing or not signed in, so that I know what to fix.
55. As a developer, I want to be able to point aidea at a different agent for the Tutor later, so that I am not locked to one provider.

## Implementation Decisions

- **Shape.** A headless **core** does all domain work and a thin **interface** displays it. The interface talks to the core only through a local protocol. The interface contains no domain logic; in particular, the calculation of where the camera looks when zooming (the Footprint framing) belongs to the core. Everything is TypeScript. The desktop shell is Electron.
- **Agent adapter.** A single interface behind which agents are driven, selectable per role (builder, tutor). The first implementation launches the user's installed, unmodified Claude Code in non-interactive mode with streaming JSON output and reads structured events from it. The bare mode is not used, because it ignores the subscription login. aidea never reads, stores or relays credentials. A second adapter that embeds an interactive terminal is a planned fallback and is not built in this spec (see Out of Scope).
- **Streamed events.** Messages, tool calls, sub-agent activity (identified by their parent tool call) and session metadata are translated into core events for the chat bar and the Canvas.
- **Permissions.** aidea supplies the permission-prompt tool. Each request becomes a card in the chat bar. The user's existing permission rules are applied first; only unresolved requests reach the card.
- **Canvas tool server.** The core exposes its own MCP server to both sessions. Builder tools create or change Nodes and Trace links and record decisions; each produces a pending Proposal. Tutor tools ask the user a question and wait for the answer, read the Learner graph, and record Propositions.
- **Authored layer store.** Business, Requirements and Architecture content, Rationales, Pattern groups and Trace links are plain text files inside the Project's repository, versioned with it. A schema validates them on every load. All agent writes go through the Canvas tool server; hand edits are allowed and validated.
- **Deriver.** Computes the Components and data, Algorithms and Code layers from the Python source of the Project, without running it. It must not require the user to install anything beyond the Project's own Python. The analysis mechanism is chosen at implementation time.
- **Trace link engine.** Computes each Node's Footprint (many-to-many with the layer below), detects Broken links after every recomputation, and checks Pattern groups against the derived structure to report violations.
- **Playback.** Runs a chosen function in the Project's own Python environment on sample inputs and records an execution trace (steps and values). Playback replays that recording and never re-runs live. Only functions without external effects, or with effects replaced by fake data, are eligible.
- **Tutor.** A second agent session launched with its own instructions and without the user's personal plugins and instructions. Phases follow the learnharness method: Probe, then plan and teach with predict-then-reveal, with Practice deferred. This is a reimplementation of the method, not a copy of its code or prompts (learnharness is AGPL-3.0).
- **Learner graph.** A per-user store of Propositions and Reasoning chains, each linked to its source session and, when relevant, to the Project Node where it was learned. Append-only line-oriented files. Written by a pipeline mirroring learnharness: an extractor reading the Tutor's prose, an auditor that finds duplicates, and a deterministic merger as the only writer.
- **Class and Direct mode.** A user setting. In Class mode a Blocking decision pauses the builder until the Tutor's question is answered; in Direct mode no automatic pauses occur. Text selection works in both.
- **Blocking decision definition.** A new or changed Node on layers 1 to 3, a technology choice, or the declaration of a Pattern group. Code changes are never blocking.
- **Notations.** Business Model Canvas, user stories, C4-style containers and components, class and table Nodes, control-flow graph. The novelty is zoom and Playback, not new symbols.
- **Interface.** Projects on the left, Canvas in the center, Tutor panel on the right showing material for the selected Node, chat bar in the footer. The Canvas is read-only for layout and content: the user cannot create or drag Nodes by hand but can accept or reject Proposals. The Code layer offers an "open in my editor" action.
- **Product naming.** The product name and branding must not include Anthropic or Claude Code names or logos.

## Testing Decisions

- **One seam:** the core's local protocol. Tests send requests through it and assert only on what comes out: layers, Nodes, Footprints, Proposals, Broken links, events, Tutor questions and Learner graph content. Internal modules are not tested directly.
- **A good test** checks external behavior that a user could observe and survives any internal refactor. It never asserts on private structure.
- **Fake Agent adapter.** Replays recorded Claude Code event streams, so tests need no login, no network and no cost. Recordings are captured once from a real session.
- **Fixture Project.** A small, fixed Python project (including a web-style layout, a class with methods and a function suitable for Playback) shared by all tests.
- **Real Claude Code** is covered only by a manual verification, since it needs the user's login.
- **The interface** has no automated tests in this spec; its thinness is the mitigation.
- **Prior art:** none, the repository is empty. The learnharness repository keeps pure domain logic free of I/O behind ports, which fits this approach.
- A second, lower seam (source code in, graph out) is added only if testing the Deriver through the protocol becomes unwieldy.

## Out of Scope

- Multiple builder agents at once.
- Practice sessions (generated problems on the user's own Project) and practising while developing.
- Support for languages other than Python (C# is next).
- Mobile and game Projects.
- An embedded code editor.
- The embedded-terminal Agent adapter (fallback only).
- Creating or arranging Nodes by hand on the Canvas.
- Tutor providers other than Claude Code (the Agent adapter interface allows it later).
- A monitor for Anthropic policy news (recorded as a separate future tool).
- Publishing or distributing aidea to other users.

## Further Notes

- **Policy dependency.** Anthropic's support article says the Agent SDK, `claude -p` and third-party apps keep drawing on subscription limits "for now"; a previously announced change is paused with no end date. The adapter must stay swappable. See ADR 0001.
- **To verify at implementation:** the exact option that isolates the Tutor session from the user's global plugins while keeping the subscription login; how long Claude Code waits on a slow MCP tool call while a person answers; the stability of the streaming event format; how the Python analysis is run.
- **Inferred, not explicitly decided:** the Learner graph lives in per-user storage outside any Project repository.
- **Vocabulary** is defined in `GLOSSARY.md`; decisions are recorded in `docs/adr/0001` and `0002`.
