# 04 - How each layer is taught, and what animation evidence supports

Researched 2026-10-28. Scope: what courses and textbooks teach per layer, how visuals are used in class, what the animation pedagogy research says, and what that means for aidea's six layers and Tutor class mode.

Convention: **[Fact]** = from a cited source. **[Opinion]** = my inference for aidea. Quotes are verbatim from pages I read or from abstracts surfaced by search; where only a secondary summary was seen, it says so.

## TL;DR

1. Courses teach these layers mostly with **static, annotated diagrams plus a worked example**, not with animation. Animation in class is mostly teacher stepping through, or a tool like Python Tutor.
2. Evidence on animation: it helps mainly when the learner is **engaged** (predicting, stepping, changing, constructing). Passive viewing shows weak or no gains. Your belief "more motion = faster understanding" is **not supported**.
3. Hundhausen et al. (2002): how learners *use* a visualization matters more than what it shows. Naps et al. (2002): visualization has little value unless it engages learners actively.
4. Tversky/Morrison/Betrancourt (2002): most fair comparisons (animation vs. equivalent sequence of stills) show no animation advantage; animations are often too fast or complex; interactivity can help.
5. Per layer, the documented animated practice is thin: **C4 dynamic diagrams** (numbered interactions), **Strategyzer "unveil one sticky note at a time"**, **Python Tutor step-through**. Business, Requirements and Components animations are largely our own idea.
6. Recommendation: make every animation **user-stepped and prediction-gated** (predict, then step, then explain). Use motion only to carry order, flow or state change. Colour as an encoding (same meaning everywhere), not decoration.
7. A class segment in these courses is: motivation, concept, worked example, trace, exercise/prediction, summary. Tutor class mode maps onto it directly (section 8).
8. Prediction before reveal has strong evidence in physics education (Peer Instruction: normalized gain ~0.48 vs ~0.23 in traditional courses, Hake data as cited by Crouch and Mazur); CS-specific evidence for predict-reveal is weaker and I did not verify it.
9. Beginners benefit from worked examples; for experienced learners they can hurt (expertise reversal). Class mode needs an off-ramp or fading.
10. Several primary PDFs (Guo, Tversky, Hundhausen) could not be text-extracted; I relied on abstracts and search summaries. See "Not verified".

---

## 1. Business layer (business model)

### What courses teach (order)
- **[Fact]** Strategyzer's own guidance on presenting a Business Model Canvas: reveal it piece by piece. "Unveil your Canvas one sticky note at a time to communicate your idea effectively step by step." ([Strategyzer, Telling your story](https://www.strategyzer.com/library/telling-your-story))
- **[Fact]** Same page, suggested thread: "Create a thread to your story and walk your audience through it." Example thread (from search summary of the same page): target customers, then the value proposition they want, then how you earn revenue, then the resources and activities needed to deliver.
- **[Fact]** A Strategyzer instruction manual (via a Penn State Berks copy) says the start block is flexible: some begin with customer segments or value propositions, others with key resources or activities. ([PDF](https://berkslaunchbox.psu.edu/files/2023/07/BusinessModelCanvasEditableExplained.pdf)) I saw this only as a search snippet.
- Osterwalder "Business Model Generation" / Blank entrepreneurship syllabi: **not verified** (no table of contents fetched).

### How visuals/animations are used
- **[Fact]** The canvas is a single poster of nine blocks. Showing it all at once and then explaining it "leads to what we call 'cognitive murder'" ([Strategyzer](https://www.strategyzer.com/library/telling-your-story)). Teaching practice is progressive disclosure, which is effectively a manual animation.
- **[Fact]** The article also says: "Connect your sticky notes in the order that logically makes sense to tell your story."

### Meaningful animation for aidea (opinion)
- **[Opinion, well grounded]** A reading-order walkthrough: blocks light up one at a time along a thread (customer, value, revenue, then delivery), with connecting arrows drawn between notes so no block is an "orphan" (Strategyzer's term). This is documented practice, only the software automation is ours.
- **[Opinion]** Predict-gate: "which block would you fill next?" before the next reveal. Not documented for the canvas.

---

## 2. Requirements layer (user stories, acceptance criteria)

### What courses teach (order)
- **[Fact]** UC Berkeley CS 169A (Fall 2021 syllabus) topics include "behavior-driven design, test-driven development, user stories for requirements elicitation & documentation", and Agile vs. plan-and-document comparison (via search result, [bCourses syllabus](https://bcourses.berkeley.edu/courses/1545490/assignments/syllabus), [CS169A page](https://www2.eecs.berkeley.edu/Courses/CS169A/)). Current catalog text: "convert customer requirements into a software plan that can be effort-estimated, built, and deployed".
- **[Fact]** Earlier Fox/Patterson SaaS course material: user stories written as Cucumber scenarios (Given/When/Then), tools RSpec, Cucumber, Pivotal Tracker ([edX CS169.1x lecture 8](https://courses.edx.org/c4x/BerkeleyX/CS-169.1x/asset/169xLecture8.pdf)). I only saw this through search summaries.
- **[Fact]** SWEBOK v4 Requirements KA covers eliciting, analyzing, specifying, validating and managing requirements ([IEEE CS SWEBOK](https://www.computer.org/education/bodies-of-knowledge/software-engineering); list of 18 KAs via a SEBoK-hosted table, not official text).
- **[Fact]** Sommerville 10th ed: Chapter 4 is requirements engineering, then 5 system modelling, 6 architectural design, 7 design and implementation ([Pearson listing](https://www.pearson.com/store/p/software-engineering-global-edition/P200000005464)); listings disagree on some details.
- Order in practice, from the above: elicit, write as stories, refine into scenarios/acceptance criteria, turn scenarios into automated acceptance tests, then implement.

### How visuals/animations are used
- **[Fact]** Mostly text artefacts (story cards, feature files). The visual is the trace from story to scenario to test, shown on slides.
- No documented animation for this layer.

### Meaningful animation for aidea (opinion)
- **[Opinion, our idea]** A story card "travels" through three stops: story, acceptance criteria (each criterion highlights), then the code/test that satisfies it (links drawn). Motion encodes traceability, which is a real concept (requirement-to-code), but I found no course that animates it.
- **[Opinion]** Predict-gate: "which criterion is missing?" before revealing the Given/When/Then.

---

## 3. Architecture layer (C4 containers, patterns, hexagonal)

### What courses teach (order)
- **[Fact]** SWEBOK v4 added Software Architecture as a new KA (alongside Software Engineering Operations and Software Security) ([IEEE CS SWEBOK](https://www.computer.org/education/bodies-of-knowledge/software-engineering)).
- **[Fact]** Bass-Clements-Kazman 4th ed. (Pearson): Part I "Introduction" starts with architectural structures and views and what makes an architecture good, then why architecture matters (quality attributes, stakeholder communication). Book covers performance, modifiability, security, availability, interoperability, testability, usability, deployability ([Pearson](https://www.pearson.com/en-us/subject-catalog/p/software-architecture-in-practice/P200000000111/9780137468218)). Exact chapter titles for tactics, patterns and documentation: **not verified**.
- **[Fact]** CMU 17-214 (Spring 2019 deck): an introduction to design (goals, principles, patterns) followed by designing classes for change ([CMU slides](https://www.cs.cmu.edu/~mhilton/classes/17-214/s19/slides/20190115-infrastructure.pdf)). Current syllabus not retrieved (cs.cmu.edu schedule returned 404).
- Order in practice: quality attributes and views first, then patterns/tactics as answers to quality needs, then documentation. Hexagonal architecture is not in the sources I could confirm; treat as industry rather than course content.

### How visuals/animations are used
- **[Fact]** C4 **dynamic diagram**: shows "how elements in the static model collaborate at runtime to implement a user story, use case, feature, etc." It uses "numbered interactions to indicate ordering" and is based on UML communication diagrams ([c4model.com dynamic](https://c4model.com/diagrams/dynamic)).
- **[Fact]** Same page says it should be used sparingly, for interesting or recurring patterns or complicated interactions.

### Meaningful animation for aidea (opinion)
- **[Opinion, strongly grounded]** Play one scenario over the static C4 diagram: a token follows interaction 1, 2, 3 along relationship arrows, with the numbered label matching C4's convention. The numbering is documented; the live token is ours.
- **[Opinion]** For patterns such as hexagonal: highlight a request crossing port, adapter and domain, then show a swap of one adapter with the domain unchanged (change-and-see). Documented as a concept, not as an animation.

---

## 4. Components and data layer (modules, classes, attributes, UML-style)

### What courses teach (order)
- **[Fact]** MIT 6.005 (Spring 2016) readings, in order: Static Checking, Basic Java, Testing, Code Review, Version Control, Specifications, Designing Specifications, Avoiding Debugging, Mutability and Immutability, Recursion, Debugging, Abstract Data Types, Abstraction Functions and Rep Invariants, Interfaces, Equality, Recursive Data Types ... ([OCW readings](https://ocw.mit.edu/courses/6-005-software-construction-spring-2016/pages/readings/)). Snapshot diagrams appear in reading 2 (per search summary of the same course).
- **[Fact]** Fowler, UML Distilled 3rd ed: Chapter 3 Class Diagrams: The Essentials (properties, associations, multiplicity, operations, generalization, dependency), Chapter 4 Sequence Diagrams (participants, loops, conditionals, sync/async), Chapter 5 Class Diagrams: Advanced Concepts ([Pearson](https://pearson.com/store/p/uml-distilled-a-brief-guide-to-the-standard-object-modeling-language/P200000000255/9780321193681), via search summary).
- **[Fact]** Sommerville ch. 5 System modelling (UML not confirmed by name in my results).
- Order in practice: classes and attributes (static structure) first, then dynamic behaviour (sequence diagrams) as a second view, then advanced relations.

### How visuals/animations are used
- **[Fact]** UML diagrams are drawn statically, annotated by the teacher; a sequence diagram is itself a time-ordered picture. MIT's snapshot diagrams show object state at a point in time, i.e. a trace-table-like frame rather than an animation.
- C4 dynamic diagrams (above) are explicitly "similar to a sequence diagram".

### Meaningful animation for aidea (opinion)
- **[Opinion, partly grounded]** Messages flowing between objects, one step at a time, with the object's attribute values changing in a side panel. This is the same idea as Python Tutor's frames (section 7) and snapshot diagrams, and it matches a sequence diagram's ordering. Combination is ours.
- **[Opinion]** Dependency impact: click a module, dependants flash. Not documented as teaching practice.

---

## 5. Algorithms layer (flowchart of one Python function, Playback)

### What courses teach (order)
- **[Fact]** CS1/CS2 style: trace code by hand with a trace table, then use a program visualizer. Guo's Online Python Tutor was used in CS1 courses at about a dozen universities including UC Berkeley and MIT, and embedded in three Python textbooks, per its abstract/intro ([Guo, SIGCSE 2013 PDF](https://pg.ucsd.edu/publications/Online-Python-Tutor-web-based-program-visualization_SIGCSE-2013.pdf), [Google Research page](https://research.google/pubs/online-python-tutor-embeddable-web-based-program-visualization-for-cs-education/)). The PDF could not be text-extracted; this is from search summaries.
- **[Fact]** Online Python Tutor lets users "move forward and backward through execution" and inspect data structures (search summary of abstract).

### How visuals/animations are used
- **[Fact]** Step-through with forward and backward buttons is the dominant pattern: learner controls the pace; stack frames and heap objects drawn as boxes and arrows.
- **[Fact]** The concept behind it is the **notional machine**: the idealised computer implied by a language's constructs (du Boulay et al.), which Sorva developed; a pedagogical device that explains program behaviour ([Fincher et al. 2020 summary](https://luce.si.usi.ch/publications/2020-06-01-notional-machines.html)).
- **[Fact]** Sorva, Karavirta and Malmi, "A Review of Generic Program Visualization Systems for Introductory Programming Education", ACM TOCE 13(4), 2013 ([DBLP](https://dblp.uni-trier.de/pid/68/1338.html)). I could not retrieve its findings.

### Meaningful animation for aidea (opinion)
- **[Opinion, strongly grounded]** Playback = highlight current flowchart node, show variable values (a trace table filling in), with step forward and back and a "predict the next node/value" gate. This is the best-supported animation of the six layers.

---

## 6. Code layer

### What courses teach (order)
- **[Fact]** MIT 6.005 puts testing, code review and version control before ADT design; specifications before implementation ([OCW readings](https://ocw.mit.edu/courses/6-005-software-construction-spring-2016/pages/readings/)). CS 169A pairs behavior-driven design with test-driven development ([bCourses](https://bcourses.berkeley.edu/courses/1545490/assignments/syllabus)).

### How visuals/animations are used
- **[Fact]** Code is shown as annotated listings, live-coded, or reviewed. Animation here is the same step-through as Algorithms (Python Tutor).

### Meaningful animation for aidea (opinion)
- **[Opinion]** Link-highlighting: select a flowchart node or story criterion and the corresponding lines light up (and back). No documented teaching practice; it is a navigation aid, not animation per se.

---

## 7. Cross-cutting: what the animation evidence says

- **[Fact]** Hundhausen, Douglas and Stasko 2002, a meta-study of 24 experiments, concluded that "how students use AV technology has a greater impact on effectiveness than what AV technology shows them" (quote from a secondary summary of the abstract). Procedural knowledge tests were more sensitive to differences than conceptual ones. ([abstract copy, Academia.edu](https://www.academia.edu/15636659/A_Meta_Study_of_Algorithm_Visualization_Effectiveness))
- **[Fact]** Naps et al. 2002 (ITiCSE working group): visualization is of little educational value unless it engages learners in an active learning activity (paraphrase from search summary). Engagement taxonomy: no viewing, viewing, responding, changing, constructing, presenting ([ITiCSE 2002, DOI 10.1145/960568.782998](https://doi.org/10.1145/960568.782998), levels per a 2020 secondary report). Note it has a "no viewing" level too, so the list you gave is missing one.
- **[Fact]** Tversky, Morrison and Betrancourt 2002: "animations are often too complex or too fast to be accurately perceived"; judicious interactivity "may overcome both these disadvantages". Course summary: most fair comparisons (animation vs. a sequence of stills) found no animation advantage ([IJHCS paper](https://hci.stanford.edu/courses/cs448b/papers/Tversky_AnimationFacilitate_IJHCS02.pdf)). Sections: congruence principle and apprehension principle.
- **[Fact]** Peer Instruction: pre/post gains with ConcepTests. Normalized gain 0.48 for interactive vs 0.23 for traditional courses (Hake data as cited) ([Crouch and Mazur 2001](https://mazur.harvard.edu/publications/peer-instruction-ten-years-experience-and-results)). Physics, not software; the answer-before-explanation structure is the relevant part.
- **[Fact]** Worked example effect: worked examples free working memory for novices. Expertise reversal: for experienced learners the steps become redundant and can "hamper learning" (Kalyuga et al. 2003, via summaries; [Springer review](https://link.springer.com/10.1007/s10648-016-9359-1)).

**Implications for aidea [Opinion]:**
1. Do not claim "more motion = faster". The evidence supports "more *engagement* with a well-designed visualization = better learning".
2. Every animation: user controls (play, pause, step, back); never autoplay-only.
3. Gate each animation behind a prediction (Naps "responding" level). Add "change a parameter and re-run" (changing) and "build your own" (constructing) later.
4. Motion must encode something (order, direction, state change). If it would look the same as a static picture with numbers, make it static.
5. Colour: one meaning per colour across layers (for example, "active step"), consistent legend.
6. Prefer progressive disclosure over continuous motion (Tversky: continuous events are conceived as discrete steps).
7. Fade guidance for experienced users (expertise reversal): allow skipping the worked example and going straight to prediction.

---

## 8. Shape of a class segment, and Tutor class mode

**[Fact, composite]** The sources show a repeated lecture pattern: MIT 6.005 readings pair concepts with in-reading exercises and snapshot diagrams; Peer Instruction inserts a question mid-lecture; Python Tutor adds a step-through trace. I did not find one document that states a single canonical segment, so the sequence below is my synthesis.

| Segment | Classroom form | aidea Tutor class mode |
|---|---|---|
| Motivation | "Why does this matter?" / problem | Tutor states the decision the builder just reached, in one line |
| Concept | Definition and key diagram | One annotated static diagram of the layer |
| Worked example | Instructor solves a small case | Tutor steps the diagram on the person's own project |
| Trace | Step through, trace table | Playback / numbered scenario, user-controlled |
| Exercise / prediction | ConcepTest, "what happens next?" | Predict before each reveal; then show rationale |
| Summary | Takeaway slide | One-line rule plus link to the decision |

**[Opinion]** Order prediction before the reveal, and keep each segment short (one decision per interruption). Offer a "skip, I know this" path (expertise reversal).

---

## Not verified / paywalled
- Original full text of Hundhausen 2002, Naps 2002, Sorva 2013, Guo 2013, Tversky 2002: PDFs unreadable via the fetch tool or paywalled; claims come from abstracts and search summaries. The 11-of-24 significant-results figure for Hundhausen is a secondary citation, not used above.
- MIT 6.005 Fall 2016 (web.mit.edu) returned 403; used OCW readings instead. CMU 17-214 current schedule returned 404; only the 2019 deck summary was seen. Stanford and MIT 6.102 were not checked.
- Sommerville, Fowler, BCK: only publisher listings via search snippets; chapter-level UML and tactics/patterns/documentation chapters unconfirmed. Osterwalder/Blank syllabi not found.
- SWEBOK v4 KA list is from a SEBoK-hosted table, not the official PDF. SE2014 / CS2023 curriculum guidance not checked.
- Sweller original papers not read; worked-example and expertise reversal claims are from review summaries.
- Predict-observe-explain evidence for CS and software engineering: not searched in depth.

## Open questions
- Does aidea's learner already know UML/C4 notation? That decides how much "concept" segment is needed (expertise reversal).
- Should the Tutor measure prediction accuracy and fade scaffolding automatically?
- Is there evidence that animated traceability (story to code) helps? I found none; worth a small usability test rather than a literature search.
- Which licence terms apply to reusing Strategyzer's canvas layout and the C4 notation visuals? (Not researched here; relevant to the "zero legal problems" rule.)
