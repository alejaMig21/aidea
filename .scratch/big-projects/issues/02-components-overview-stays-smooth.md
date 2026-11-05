# 02: The Components overview stays smooth with the test modules open

**What to build:** With Telegram's test modules open the overview draws 1,806 SVG elements (242 rectangles, 400 routes) and moving it is slow: 17 frames per second in Vivaldi, 13 in headless Chrome, against 53 and 27 with the tests closed. Taking the 400 route paths away brings it back to 54 in the same test; taking away only their arrowheads brings it to 24; removing the text, the rectangles or the `title` elements changes nothing, and the Animations switch changes nothing. So the routes are the cost, and the arrowheads about half of it. Make the drawing cheaper without losing information: draw an arrowhead only when the zoom makes it readable (as module names already wait for zoom), draw the routes of one kind as few path elements as possible instead of one each, and draw only what is on screen. Target: at least 30 frames per second moving the Telegram overview with the tests open, in Vivaldi.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A page test measures frames per second moving a generated overview of the same size and fails below a stated budget (headless Chrome, written in the test).
- [ ] Telegram with the tests open moves at 30 frames per second or more in Vivaldi (measured with the same method as in this ticket).
- [ ] Hovering a route still says what it is, and the legend still matches what is drawn (the legend check passes).
- [ ] With the tests closed and with 40 modules or fewer, the drawing looks as before.

Measured 2026-11-05 on the person's Telegram project (209 Python modules, 3,964 functions, 659 classes, 13,004 relationships), Windows, this machine. Method: pan by 4 px per animation frame for 1.5 s and count frames; script in the agent's scratchpad (`fps.mjs`), to be moved to the repository with this ticket.
