# 03: The Algorithm graph is a flowchart

**What to build:** The Algorithm graph uses flowchart notation (spec: Algorithm graph). Start and end are stadium terminators; a step is a process rectangle; `if` and `match` are decision diamonds with labelled exits (Yes/No; one exit per pattern for `match`); a loop is a decision with exits (`for`: next item or done; `while`: yes or no) and a plain upward arrow back; calls to the known input and output functions (the list Playback already treats as external effects, plus `print` and `input`) are parallelograms; `return` is a terminator and `raise` a red-tinted terminator; `try`/`except` shows a dashed red edge labelled with the exception type to the handler; `with`, `finally`, `break` and `continue` are drawn distinctly; any construct without a symbol is a generic step that names the construct and is never omitted. Positions and routes come from the layout engine. The layer's legend lists the symbols and what the flowchart leaves out. Edges flow in their direction; during Playback a token travels along the edges of the real recording and the active step glows, visited steps turn teal, and the exception edge flashes red only when taken. The Playback form, values and controls keep working.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Through the core protocol: each flow step carries what the interface needs to choose its symbol (kind, labelled exits, input/output flag, exception type on exception edges); a construct without a symbol is reported as a generic step with its name.
- [ ] Every symbol above is drawn from the data; no step is omitted; a function with `try`/`except`/`finally`, `with`, `break`, `continue`, a loop and a `match` renders without overlaps or crossing edges through nodes.
- [ ] Playback: the token follows the recording's path and the highlighting rules above hold; pausing and stepping still work; the animation switch and reduce-motion are respected.
- [ ] The legend opens from the "?" button and lists symbols and omissions.
- [ ] Verified headless: screenshots of the same sample function next to the prototype's Algorithms tab at 1440x900, differences listed in the review notes; token positions sampled at two moments; no console errors.
