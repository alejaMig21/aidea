# Notation research 02: C4, Business Model Canvas, requirements

Date: 2026-10-28. Method: fetched primary pages; where a page lacked a fact, it is flagged. Read-only research, no code touched.

## TL;DR

1. C4 is explicitly notation independent. Author: ["The C4 model is notation independent, and doesn't prescribe any particular notation."](https://c4model.com/diagrams/notation) We can keep our visual style but should follow his content guidelines.
2. Every C4 element needs a type and a short description; containers and components need a technology; every line is unidirectional and labelled (not just "Uses"). aidea's `{title, technology}` covers half of this; it lacks a type and a one-line description.
3. C4 containment is strictly nested: system > container > component > code. aidea's `parent` maps to this only if each Node carries a level/kind. Draw children inside the parent, not only a line to it.
4. Diagrams need a title and a key/legend. aidea should render a small legend.
5. The Business Model Canvas (BMC) has nine fixed blocks in a fixed spatial layout. A same-card grid destroys its main value (spatial reading). The official PDF is CC BY-SA 3.0 Unported, credit to Strategyzer AG required (details in section 2).
6. Layout: Key Partners | (Key Activities over Key Resources) | Value Propositions | (Customer Relationships over Channels) | Customer Segments; Cost Structure and Revenue Streams across the bottom.
7. User story: "As a [type of user], I [need/want/am required] to [do something], so that [reason or benefit]." Add acceptance criteria (Cohn's "confirmation"), optionally Gherkin.
8. A story map is a 2D layout: activities left-to-right in time, stories below by priority, release slices as horizontal lanes. A 4-per-row grid reads as a flat backlog, which story maps were invented to improve on.
9. MoSCoW (Must / Should / Could / Won't have this time) is a cheap priority badge aidea can adopt.
10. Traceability matrix: the ISO/IEC/IEEE 29148 text is paywalled and its exact form is unverified. aidea's code trace links are a legitimate lightweight version of one RTM column.

## 1. C4 model

### What the source says

- **Notation freedom.** ["The C4 model is notation independent, and doesn't prescribe any particular notation."](https://c4model.com/diagrams/notation) He still wants diagrams that are comprehensible. Colour: any colour coding must be consistent within and across diagrams (same page, paraphrase).
- **Titles and legend.** ["Every diagram should have a title describing the diagram type and scope"](https://c4model.com/diagrams/notation); ["Every diagram should have a key/legend explaining the notation being used"](https://c4model.com/diagrams/notation).
- **Elements.** ["The type of every element should be explicitly specified"](https://c4model.com/diagrams/notation); ["Every element should have a short description"](https://c4model.com/diagrams/notation) (an "at a glance" view of responsibilities); ["Every container and component should have a technology explicitly specified."](https://c4model.com/diagrams/notation) The page gives no separate naming guideline.
- **Relationships.** ["Every line should represent a unidirectional relationship."](https://c4model.com/diagrams/notation) ["Every line should be labelled"](https://c4model.com/diagrams/notation), as specific as possible, ideally avoiding single words like "Uses". Relationships between containers should name the technology/protocol.
- **Abstractions and containment.** ["A software system is made up of one or more containers (applications and data stores), each of which contains one or more components"](https://c4model.com/abstractions), implemented by code elements. People use systems and sit outside the hierarchy.
- **Levels.** Context, Container, Component, Code are zoom levels. System Context plus Container are described as sufficient for most teams ([diagrams page](https://c4model.com/diagrams), paraphrase). System landscape, dynamic and deployment are supplementary.
- **Container diagram scope.** One software system; inside are its containers, outside are directly connected people and systems; audience is technical ([source](https://c4model.com/diagrams/container)).
- **Deployment.** Instances of systems/containers on nested deployment nodes within one environment; cloud icons must be explained in the key ([source](https://c4model.com/diagrams/deployment)).
- **Structurizr (the author's tool).** Hierarchy is block nesting: ["The `container` keyword defines a container, within a software system."](https://docs.structurizr.com/dsl/language) A `group` is ["rendered as a boundary around those elements"](https://docs.structurizr.com/dsl/language). Relationships: `<id> -> <id> [description] [technology] [tags]`.

### What a C4-literate reader would find wrong with aidea today

Cards plus a line to the parent: no element type shown, no description, no relationship labels or direction, no legend, and containment drawn as an edge rather than an enclosing boundary. They would also ask where people and external systems are (aidea has none; `parent` only encodes the system > container > component tree).

### Recommendation for aidea (opinion)

- Add a derived or explicit `kind` (person, system, container, component) and show it on the card as text like "[Container: Node.js]". Mapping: `parent` = the "made up of / contains" relation; tree depth = level.
- Draw children inside the parent's boundary (dashed is the common convention; see Not verified).
- Add an optional one-line `description` and an optional labelled `relations[]` (from, to, label, technology) separate from `parent`. A parent edge is containment, not "calls".
- Render a legend and a title stating level and scope.
- Call it "C4-style"; do not claim full C4. Skip dynamic, deployment, landscape.

## 2. Business Model Canvas

### What the source says

- **License (verified on the official PDF).** The canvas PDF footer reads ["This work is licensed under the Creative Commons Attribution-Share Alike 3.0 Unported License."](https://www.cs.princeton.edu/courses/archive/spring18/cos448/the-business-model-canvas.pdf), with the link http://creativecommons.org/licenses/by-sa/3.0/, plus "Designed by: Strategyzer AG / The makers of Business Model Generation and Strategyzer". I read this from a Strategyzer-produced PDF copy hosted by Princeton (InDesign file dated 2014), not from strategyzer.com itself.
- **What CC BY-SA 3.0 requires.** ["You must give appropriate credit, provide a link to the license, and indicate if changes were made."](https://creativecommons.org/licenses/by-sa/3.0/) ShareAlike: ["you must distribute your contributions under the same license as the original."](https://creativecommons.org/licenses/by-sa/3.0/) (the page is a fetch summary of the deed; the 3.0 legal code wording differs slightly.)
- **Strategyzer's current page** says the template is ["Free to download and to share with anyone on your team."](https://www.strategyzer.com/canvas/business-model-canvas) It shows no CC statement and links separate terms and a Copyright & IP policy, which I did not read.
- **The nine blocks, as written on the PDF:** Key Partners, Key Activities, Key Resources, Value Propositions, Customer Relationships, Channels, Customer Segments, Cost Structure, Revenue Streams ([PDF](https://www.cs.princeton.edu/courses/archive/spring18/cos448/the-business-model-canvas.pdf), text extracted locally with pdftotext).
- **Layout (from the extracted text order and positions).** Top band, left to right: Key Partners; Key Activities stacked over Key Resources; Value Propositions (centre); Customer Relationships stacked over Channels; Customer Segments (right edge). Bottom band: Cost Structure (left), Revenue Streams (right). Header fields: Designed for, Designed by, Date, Version. Relative sizes are not recoverable from text; from memory, Value Propositions is a tall centre column and the bottom two are short wide boxes (unverified).
- **Reading order.** ["The right side is the market."](https://www.strategyzer.com/canvas/business-model-canvas) The left is what it takes to serve it, with value propositions between. Nine blocks cover who you serve, what you offer, how you deliver it, what it costs, what it earns.
- **Sticky notes.** Not described on the primary pages I fetched. Small notes inside blocks is common practice (unverified from a primary source).

### What a reader would find wrong

A 4-per-row grid reorders blocks arbitrarily and loses the left (supply) / centre (offer) / right (demand) / bottom (money) structure. Empty blocks, a classic diagnostic, are also invisible if blocks are only a field on identical cards.

### Recommendation for aidea (opinion)

- Render a fixed canvas area with blocks in canonical positions; Nodes appear as small sticky-note chips inside their `block`. Show empty blocks with a muted placeholder.
- Use the block names exactly as above.
- If the layout is derived from the Strategyzer canvas, add attribution in About or export: "Business Model Canvas by Strategyzer AG, makers of Business Model Generation, CC BY-SA 3.0, creativecommons.org/licenses/by-sa/3.0/", noting changes. Whether re-implementing the layout in our own style is a derivative work is a legal question for the owner; not settled here.

## 3. Requirements

### What the sources say

- **User story form.** Mountain Goat: ["As a [type of user], I [need/want/am required] to [do something], so that [reason or benefit]."](https://www.mountaingoatsoftware.com/agile/user-stories) The page credits Ron Jeffries' three Cs: ["card, conversation, and confirmation."](https://www.mountaingoatsoftware.com/agile/user-stories) Confirmation is usually acceptance criteria.
- **INVEST.** Bill Wake, [XP123, 17 Aug 2003](https://xp123.com/invest-in-good-stories-and-smart-tasks/): Independent, Negotiable, Valuable, Estimable, Small, Testable. ["A good story captures the essence, not the details."](https://xp123.com/invest-in-good-stories-and-smart-tasks/)
- **Gherkin.** Feature, Rule, Scenario/Example, Given (initial context), When (event or action), Then (observable outcome), And/But, Background, Scenario Outline with Examples ([Cucumber reference](https://cucumber.io/docs/gherkin/reference/)).
- **Story map (Patton).** Backbone of big activities across the top; tasks beneath; stories as "ribs". ["put the early thing on the left, and the later thing on the right."](https://www.jpattonassociates.com/the-new-backlog/) Higher cards are more necessary; the top forms the "walking skeleton" (Cockburn's term); releases are horizontal swim lanes.
- **MoSCoW.** Agile Business Consortium: Must ("Minimum Usable SubseT"), Should ("Important but not vital"), Could ("Wanted or desirable but less important"), Won't have this time ([source](https://www.agilebusiness.org/resource/video-mastering-moscow-prioritisation.html)).
- **Traceability matrix.** ISO/IEC/IEEE 29148:2018 covers requirements processes and information items ([IEC webstore listing](https://webstore.iec.ch/publication/64315); scope from a search snippet). The standard's text is paywalled; I could not confirm how it defines traceability. Practitioner guidance (secondary, medium-low confidence): an RTM links requirement ID to design, code and test artifacts, read forward and backward, with verification status tracked separately from coverage ([Jama](https://www.jamasoftware.com/?p=85420), [Modern Analyst](https://www.modernanalyst.com/Resources/Articles/tabid/115/articleType/ArticleView/articleId/2212/Connect-the-Dots-with-Requirements-Traceability-Part-2.aspx)).

### What a reader would find wrong

A uniform grid flattens the story map's two axes (time and priority), hides acceptance criteria and priority, and offers no coverage view. A card with as/want/so is fine as a card; the issue is layout plus missing confirmation and priority.

### Recommendation for aidea (opinion)

- Render the story as a sentence, "As a ..., I want ... so that ...", in card form (aidea already stores `as`, `want`, `so`).
- Add optional `priority` (MoSCoW badge) and `criteria[]` (plain lines, optionally Given/When/Then). Skip INVEST scoring.
- Later option: an `activity` field (backbone column) so the Requirements view lays out a story map with Must at the top; Nodes without it go in a default column.
- Traceability: show a trace count per Node and flag Requirements with zero code links. Call it "trace links", not an RTM, until tests or verification status exist.

## Not verified / paywalled

- ISO/IEC/IEEE 29148 normative text and its traceability form: paywalled, not read.
- C4 dashed enclosing boundary: not on the c4model.com notation, container or diagrams pages I fetched; only Structurizr's "boundary" for groups was confirmed. Dashes are convention, not confirmed author wording. Dynamic diagram page not read.
- Strategyzer.com current terms; the CC BY-SA statement came from the PDF copy and creativecommons.org.
- BMC relative block sizes and sticky-note convention: no primary source.
- Patton's "How You Slice It" and 2014 book not read; relied on his new-backlog page. Cohn's INVEST page not read (used Wake's original).
- Gherkin has no primary source for diagram usage; only keyword semantics.
- WebFetch summaries are model-condensed; quotes are as returned and not re-checked character by character.

## Open questions

1. Is a `kind` field on Architecture Nodes acceptable, or inferred from depth?
2. Do we want first-class relationships separate from `parent`?
3. Fixed or user-draggable canvas and story-map layouts?
4. Does the owner want the CC BY-SA attribution line even if only the layout idea is reused?
