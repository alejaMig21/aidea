# 03: Each legend lists only the colours its layer uses

**What to build:** The "?" legend of a layer lists only the colours that layer can actually draw. Today one shared list of colours is added to the legend of every layer, so a layer such as Business shows colours that never appear on its canvas. Each layer declares the colours it uses, with a plain-words meaning for each, and the legend shows those and no others. A layer that uses no meaningful colours shows no "Colours" section.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Business, Requirements, Architecture, Components and Algorithms each declare the colours they draw; the shared list is no longer shown whole on every layer.
- [ ] The legend of each layer shows its own colours only, each with a meaning in plain words, and a layer with none has no "Colours" section.
- [ ] Every colour a layer's legend lists is one that layer draws in at least one state (checked by reading what the layer produces, not by reading the legend).
- [ ] Verified with a headless browser: screenshots of the open legend on each of the five layers; no console errors.
