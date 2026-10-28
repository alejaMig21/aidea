# Ideas for future versions

Not tickets and not scheduled. Each line says where the idea came from; the settled design behind the first four is in `docs/adr/0004` and `0005` and the notes below.

## Settled direction (from the performance and teamwork grill)

- **Language adapters first** (ADR 0004): analyse, flow graph and run one function, behind one interface; Python first, TypeScript and JavaScript second so aidea can run on aidea.
- **Animation engine inside Algorithms:** a language-neutral recording of a run from the adapters; drawing pieces for a list, a weighted graph, a tree and a grid (stack, queue and heap are a list with a role label); and **bindings** that say which variable is which piece. The builder declares the bindings of code it wrote, the Tutor infers them for code written by others, and the person is never obliged to answer, only able to correct. Every binding records its origin and an inferred one is drawn as an assumption. Bindings live in `.aidea/`, written by a core tool, never as comments in code.
- **Performance lens** over Components and Algorithms, after the engine: first question is how time and memory grow with the size of the data. Measured in the same adapters; no estimates promised before then.
- **Teamwork:** one file per Node (ADR 0005). Real-time cursors wait for hand-editable graphs and need a relay server. What a person understands stays private.

Order: teamwork storage any time; language adapters, then the engine, then the lens.

## Pieces and features parked for later

- More drawing pieces: hash table, linked list, text with highlighted ranges, state machine, call stack and recursion tree.
- Compare two algorithms side by side on the same data.
- Let the person edit the input data of an animation.
- A timeline view for concurrency.
- A deployment view for networks and infrastructure (C4 has one; today Architecture does not draw where each part runs).
- Reconstruct the layers of an existing project: a Tutor class that reads the code and proposes Business, Requirements and Architecture, each Proposal citing the files it rests on.
- The Tutor reading sources the person attaches (a folder, a web page), read-only and treated as untrusted data.
