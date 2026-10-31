# 07: Decide how the Layout is built: plain code or a docking library

**What to build:** A throwaway prototype of the hardest cases of a Unity-like Layout (resize, split side by side and stacked, nest, tabs, drag a Panel to a new place with a preview) built both ways, plain JavaScript and one candidate docking library, judged on smoothness, size, fit with the Electron app and ADR 0003's own criterion. The outcome is a new ADR that amends or supersedes ADR 0003. Nothing of the prototype is kept except the verdict.

**Blocked by:** 04 (Code panel: the six Panels exist).

**Status:** ready-for-agent

- [ ] Both prototypes live on a `prototype/` branch and are measured on the same scenario (drag, resize, nested split) on the real window.
- [ ] A recommendation with the numbers or observations behind it, and a DECISION line in the log for the person to confirm.
- [ ] The ADR is written and ADR 0003 points to it.
- [ ] Only the verdict is folded back into the main code.
