# 02: The Components overview stays smooth with the test modules open

**What to build:** With Telegram's test modules open the overview draws 1,806 SVG elements (242 rectangles, 400 routes) and moving it is slow: 17 frames per second in Vivaldi, 13 in headless Chrome, against 53 and 27 with the tests closed. Taking the 400 route paths away brings it back to 54 in the same test; taking away only their arrowheads brings it to 24; removing the text, the rectangles or the `title` elements changes nothing, and the Animations switch changes nothing. So the routes are the cost, and the arrowheads about half of it. Make the drawing cheaper without losing information: draw an arrowhead only when the zoom makes it readable (as module names already wait for zoom), draw the routes of one kind as few path elements as possible instead of one each, and draw only what is on screen. Target: at least 30 frames per second moving the Telegram overview with the tests open, in Vivaldi.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live in Electron on the second monitor: 36 frames per second with the tests open, from 15)

- [x] `test/overview-smooth-page.test.ts` guards the causes: the 400 lines are faint by stroke-opacity and not opacity, there is no arrowhead at the fitted zoom, the heads come back when zoomed in, and hovering a module lights its lines fully. It does not count frames: a headless browser with a virtual clock cannot, so the frames are measured live (next box).
- [x] Telegram with its tests open moves at 36 frames per second (15 before) in the real Electron window on the second monitor, and 80 with the tests closed (30 before): `.scratch/big-projects/live-scripts/overview-fps.mjs`. Not measured in Vivaldi: its extension hangs on a frame-counting loop.
- [x] A route still has its title and its lines still light when its module is hovered (page test); the legend check passes.
- [x] With 40 modules or fewer nothing changed: the detail drawing is untouched. With the tests closed the overview looks the same, without arrowheads at the fitted zoom.

Measured 2026-11-05 on the person's Telegram project (209 Python modules, 3,964 functions, 659 classes, 13,004 relationships), Windows, this machine. Method: pan by 4 px per animation frame for 1.5 s and count frames; script in the agent's scratchpad (`fps.mjs`), to be moved to the repository with this ticket.

## What was built (2026-11-05)

- `47-components.js`: `.cp-ov-edge` is faint by `stroke-opacity: .15` and no longer by `opacity: .15`. An element with opacity under 1 is drawn on a layer of its own; 400 of them were the largest cost (13 to 22 frames per second in the headless experiment on its own). The arrowhead (`marker-end`) is a CSS rule under `#cp-root.ov-heads`, turned on by `componentsZoomed` from the zoom where a 12 px head would be 7 px on screen (k of 0.58); before, it was an attribute on every line at every zoom (another 22 to 29).
- Hover keeps its look: the lines of the hovered module are at stroke-opacity 1 and the others at .18, with no double dimming.
- Experiment, in headless Chrome with software drawing (frames per second): 13 as it was; 22 with stroke-opacity; 29 with stroke-opacity and no arrowheads; 54 with no lines at all. Text, rectangles, titles and the Animations switch changed nothing.

## Not done

- Merging the lines into a few path elements, and drawing only what is on screen. They are the next step if a bigger Project needs it; Telegram does not.
