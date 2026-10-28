# 03: The Algorithm graph is a flowchart

**What to build:** The Algorithm graph uses flowchart notation (spec: Algorithm graph). Start and end are stadium terminators; a step is a process rectangle; `if` and `match` are decision diamonds with labelled exits (Yes/No; one exit per pattern for `match`); a loop is a decision with exits (`for`: next item or done; `while`: yes or no) and a plain upward arrow back; calls to the known input and output functions (the list Playback already treats as external effects, plus `print` and `input`) are parallelograms; `return` is a terminator and `raise` a red-tinted terminator; `try`/`except` shows a dashed red edge labelled with the exception type to the handler; `with`, `finally`, `break` and `continue` are drawn distinctly; any construct without a symbol is a generic step that names the construct and is never omitted. Positions and routes come from the layout engine. The layer's legend lists the symbols and what the flowchart leaves out. Edges flow in their direction; during Playback a token travels along the edges of the real recording and the active step glows, visited steps turn teal, and the exception edge flashes red only when taken. The Playback form, values and controls keep working.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Through the core protocol: each flow step carries what the interface needs to choose its symbol (kind, labelled exits, input/output flag, exception type on exception edges); a construct without a symbol is reported as a generic step with its name.
- [ ] Every symbol above is drawn from the data; no step is omitted; a function with `try`/`except`/`finally`, `with`, `break`, `continue`, a loop and a `match` renders without overlaps or crossing edges through nodes.
- [ ] Playback: the token follows the recording's path and the highlighting rules above hold; pausing and stepping still work; the animation switch and reduce-motion are respected.
- [ ] The legend opens from the "?" button and lists symbols and omissions.
- [ ] Verified headless: screenshots of the same sample function next to the prototype's Algorithms tab at 1440x900, differences listed in the review notes; token positions sampled at two moments; no console errors.

## Review notes

Core: `flow.py` steps now carry `construct`, `generic`, `io`, `finally`, `exception`, `exits` (match: one per pattern, plus `pattern` on `case` steps); edges carry `exit` and `exception`. The input/output list lives in `src/core/effects.py`, shared by Playback and the extractor (plus `print` as output). `/algorithm` also returns `lines` per step (wrapped label) and `layout.ts` sizes each symbol from its text (diamonds wider/taller, parallelograms padded). UI: `50-algorithm.js` draws the symbols, the legend and the token; `60-playback.js` calls `flowReplay`.

- [x] Protocol: symbol data on every step, generic step for lambda / comprehension / pass (`test/flowchart-symbols.test.ts`, fixture `test/fixtures/flow/symbols.py`).
- [x] Every symbol drawn from the data, none omitted: `symbols.tour` (for, while, if, match, try/except/finally, with, break, continue, input/print/open, lambda, comprehension, return, raise) rendered headless; no rectangle overlaps (tested). Edge routes through nodes were checked by eye only at 37% zoom, not asserted for this fixture.
- [x] Playback (headless, `sample.total` with prices ["10","abc","5"]): token follows the recorded edge, active step glows accent, visited teal, taken edges teal, exception edge red and flashing only after it is taken (count of taken exception edges 0 at step 7, 1 at step 12). Token sampled: mid-flight at step 4 (93,244) then (745.5,548) settled at step 7; mid-flight at step 9 (83,244) then (288.5,446) at step 12. Stepping and slider scrubbing work; motion off or a jump of more than one step moves the token without animating.
- [x] Legend opens from "?" with symbols, arrows, colours and not-shown list.
- [x] No console errors except one 404 (a static resource, present before this ticket; not investigated).
- [ ] Side-by-side screenshots against the prototype were not compared pixel by pixel; I looked at my own screenshots only.

Differences from the prototype: layout is the engine's, not hand-placed (the `return` sits beside the loop and the back edge runs far right); the token is a plain dot parked on the step's centre (covers some text); loop exits are labelled "next item / done" and "yes / no"; break/continue are pointed pentagons and with has a double frame (not in the prototype); no trace table or narration.

Remaining: the exception edge is drawn from `try`, while the run raises from inside the body, so the token jumps to the handler along that edge; the `finally` marker is only a dotted outline and a tag.

## Review fixes

- `flow.py`: a call to a known I/O function now flags the step wherever it sits: `with` items, a `for` iterable, an `if`/`while` test, a `match` subject, a `return`/`raise` value. A plain step is still drawn as a parallelogram; a decision, loop, `with` or terminator keeps its own symbol and carries an `input`/`output` tag instead. `eval`, `exec` and `__import__` stay in the Playback effect list (it fakes them) but are no longer reported as I/O (`effects.io_of`). Fixture `symbols.reads` and tests added; the old assertion that a `with open(...)` step has no `io` flag was replaced (the flag is now set, the symbol stays a double frame).
- `flowBox` sizes I/O-flagged control steps by their own symbol, not as parallelograms.
- Branch and loop diamonds are stroked with the neutral label colour; accent is kept for the Playback token ("active now").
- The exception `flow-flash` is under `body:not(.motion-off)` and a `prefers-reduced-motion` rule, and is more specific than the kit's dash rule: computed `animation-name` is `flow-flash` with motion on and `none` with motion off (headless).
- Flow edges now carry the kit's packets (forward edges only, red for an exception edge) and the start terminator breathes; a recording hides the packets (headless: 6 packets moving on an idle `ops.drain`, 0 visible during a replay; motion off stops the breathing).
- A leftover `has-recording` class made a newly opened graph look dimmed; it is cleared when a graph opens and when the Project is redrawn.
- Not done: the open items of the review notes above (side-by-side comparison with the prototype) are unchanged.
