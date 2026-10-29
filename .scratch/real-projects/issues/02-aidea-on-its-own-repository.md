# 02: aidea understands its own repository

**What to build:** The person wants a build of aidea to be able to open the aidea repository itself and show it in its layers. The core is TypeScript and the interface is plain JavaScript, so this needs the TypeScript and JavaScript language adapter (ticket 03 of language-adapters). When it exists, open this repository in the real app, look at the layers it can draw (Components for the core and the interface), and report what is useful and what is not, with tickets for the gaps.

**Blocked by:** language-adapters 03.

**Status:** done

- [x] Opening the aidea repository shows its modules, classes and functions on the Components layer, with the imports between files.
- [x] A written report (in this ticket) says what is readable, what is too big or too noisy, and what a person learning from this repository would still miss; each gap that matters becomes a ticket.
- [x] Verified in the real app on the main screen; no file of the repository changes.

## Report (live, headless Chrome, a copy of D:/Projects/aidea without .git, node_modules, .claude and .aidea; 1920 and 1280 pixels wide)

**What opened:** language line "Analysed: TypeScript, 111 files; Python, 39 files; JavaScript, 34 files." (true, and one line). Opens in 1.8 to 2.3 s, no page errors, 1,647 SVG elements. 879 nodes: 183 modules, 680 functions, 16 classes (the core is functions, not classes, so the class compartments are nearly empty). The overview was chosen automatically (183 > 40): 373 module pairs, 251 resolved calls, 10 inferred calls, 112 resolved imports. 390 relations are unresolved and none is drawn in the overview (the legend says so); in a module's detail they appear as `?` (for example `API ?` for the dynamic `import("typescript/...")`).

**Readable:** folder labels and module names at 100% zoom are clear (`src/core`, `src/core/routes`, `src/ui/features`, `electron`, with "N classes · M functions" under each module). The language line and the pair count are honest. The module detail of a small module (`layered`, `typescript-adapter`) shows its functions with the arrows between them and reads fine. The call arrows between the functions of one module are the most useful thing on screen.

**Too big or too noisy:**
- Tests and fixtures: about 90 of 183 modules and 20 of 24 folder blocks are `test/` and `test/fixtures/*`; at Fit they fill the lower half and the language line counts the 34 fixture `.py` files (ticket 07).
- One folder appears twice in a mixed project: TypeScript `src/core` and the five Python files of the same folder, which are named with dots (ticket 09).
- At Fit (32% at 1920, 20% at 1280) the folder blocks are readable but the module boxes are empty grey tiles, as designed in ticket 05; nothing says which module is which until zoomed to about 85%.
- In a module's detail, imports are dashed arrows that stop in the air with names cut to `src/core/ty...`; `server` has 17 piled up (ticket 08).

**What a person learning from this repository would still miss:**
- The Algorithms layer for any TypeScript or JavaScript function: none exists (ticket 06). Defect found and fixed here: in a mixed Python and TypeScript project the flow and run of any function went to the Python adapter, so a TypeScript function answered "The file cannot be read as Python". `adapterFor` now sends flow and run to the adapter of the file's language and says "aidea cannot draw an Algorithm graph for TypeScript code yet" (covered by `test/language-adapters.test.ts`).
- The interface (`src/ui/features/*.js`) is plain scripts that share globals, so its 34 files have no imports; the overview shows them as a block of unconnected boxes, and only a few call arrows link them (67 of the 373 pairs touch `src/ui`). Nothing says "these files share one global scope", so a learner reads the interface as unrelated modules. Not ticketed: it needs a decision about how aidea draws script-tag loading (the order in `index.html`), which is a design question for the person.
- Defect found and fixed here: a module box with no or several classes read "0 classs" (the plural added only an "s"); now "0 classes" (covered by `test/components-overview.test.ts`).

**Not verified:** the Code layer and the Tutor on this repository (no agent was run); the one console message was a 404 for a resource the page asks for, not traced.

**Tickets from this report:** 06 (TypeScript Algorithm graph), 07 (tests and fixtures drown the overview), 08 (module detail imports), 09 (one folder twice). The repository was only read; the analysis ran on the copy.
