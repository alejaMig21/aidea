# 03: Each legend lists only the colours its layer uses

**What to build:** The "?" legend of a layer lists only the colours that layer can actually draw. Today one shared list of colours is added to the legend of every layer, so a layer such as Business shows colours that never appear on its canvas. Each layer declares the colours it uses, with a plain-words meaning for each, and the legend shows those and no others. A layer that uses no meaningful colours shows no "Colours" section.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Business, Requirements, Architecture, Components and Algorithms each declare the colours they draw; the shared list is no longer shown whole on every layer.
- [x] The legend of each layer shows its own colours only, each with a meaning in plain words, and a layer with none has no "Colours" section.
- [x] Every colour a layer's legend lists is one that layer draws in at least one state (checked by reading what the layer produces, not by reading the legend).
- [x] Verified with a headless browser: screenshots of the open legend on each of the five layers; no console errors.

## Review notes

- [x] `src/ui/features/45-notation.js`: the shared `notationColours` list is gone. A layer registers `colours: [[tone, "meaning"], ...]` next to `shapes`, `arrows` and `notShown`; the legend renders only those, and no `colours` means no "Colours" section (the existing `notationList` already returns nothing for an empty list). Each layer's declared colours are read back with `notationLegends[layer].colours` (the hook ticket 04 can use). The patterns and drift files extend a legend with `...legend`, so they keep the colours of the layer they extend.
- [x] Declared per layer, from reading the drawing code and CSS: Business amber and the red outline of a broken link or drift; Requirements amber, teal (link to code), grey dashed (link not found) and red outline; Architecture amber, blue (Proposal), red (broken link, drift, pattern rule broken, Proposal to remove) and grey (possible violation); Components teal (package names), blue (the travelling dot) and grey dashed (unresolved); Algorithms blue (token, active step, dots), teal (taken or visited) and red (exception).
- [x] RED first, then green, with a headless script (not in the repo): before, every layer rendered all five rows; after, each renders exactly its declared rows (2, 4, 4, 3, 3), none shows the whole list, and there are no console errors. The same script paints each layer of six fixtures (`studio`, `studio-c4`, `studio-bad`, `traced`, `hexagonal`, `studio-requirements`) and reads the computed fill and stroke of the drawn SVG: every declared tone was seen except four that need a state those fixtures do not have. A second script forced those states and read the computed colour: a Business note with a broken link is red, an unresolved call on `relations` is grey, a possible pattern violation is grey, a taken Algorithm edge and a visited step are teal.
- [x] Screenshots of the open legend on the five layers were taken in headless Chrome (outside the repo); typecheck clean, 384 tests, 383 pass, 1 skipped.
- NOT done: no automated test of the interface (the check is a headless script outside the suite; ticket 04 is meant to turn it into a checked project); the Algorithms teal is only drawn during a Playback, so it was checked by forcing the `taken` and `visited` classes, not by a real recording; the meanings were not reworded for the "Python" sentences of other tickets (not touched).
