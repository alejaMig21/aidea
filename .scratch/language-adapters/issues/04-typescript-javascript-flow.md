# 04: The flow graph of a TypeScript or JavaScript function

**What to build:** The Algorithms layer for the second adapter: the flow graph of one function (start, steps, decisions with labelled exits, loops with a way back, returns, throws, try and catch), in the same shape the Python flow graph has, so the existing drawing and legend work unchanged.

**Blocked by:** language-adapters 03.

**Status:** done (`src/core/typescript-flow.ts`, tests in `test/typescript-flow.test.ts`; shares its work with real-projects 06)

- [x] Through the protocol on fixtures: if, else, switch, for, for-of, while, do-while, break, continue, return, throw and try/catch produce the expected steps and labelled exits.
- [x] A construct without a symbol (an async function, a generator, a class field) is drawn as a generic step that names it, as in the Python flow.
- [x] Verified in the real app on the main screen: double click a function of a JavaScript fixture and read its flow graph. (Done on `flowReplay` of `src/ui/features/50-algorithm.js` in a copy of aidea's own src, at 1920x1080 and 1280x720.)
