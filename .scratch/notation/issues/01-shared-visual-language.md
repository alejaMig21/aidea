# 01: Shared visual language: colour meaning, ambient motion and legends

**What to build:** The foundation every diagram layer uses, so the other tickets only add their own shapes. Colours get one meaning each on every layer (accent: active or in flight; teal: visited or derived; amber: authored; red: error or exception; grey dashed: unresolved or inferred) as named tokens. A small reusable motion kit draws arrows that flow in their direction, an element glow that breathes slowly (about 2.5 s), and a packet (a small glowing dot) that travels along any edge from source to target in a loop. A global "Animations" switch in the top bar turns all motion off; the system's reduce-motion setting starts it off; motion pauses while the window is hidden; unresolved edges never move. Hovering or focusing an element lights its incoming and outgoing edges and dims the rest. Each layer's Canvas card gets a "?" button that opens a legend popover (shapes, arrows, colours, and a "not shown" list) fed by the layer; the popover is closed by default. The kit is plain CSS and SVG with no library and is exercised on the existing drawings (for example the current Architecture arrows) so it is demoable on its own.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Colour tokens exist with one meaning each and are used by the kit; no layer redefines them.
- [ ] A reusable way to mark an edge as flowing, an element as breathing and an edge as carrying packets, driven by data attributes or classes, with the packet following the edge's own path.
- [ ] The "Animations" switch turns everything off and back on, is remembered between sessions, and starts off when the system asks to reduce motion; hidden-window pause works.
- [ ] Unresolved (grey dashed) edges never animate.
- [ ] Hover and focus light an element's edges and dim the rest; keyboard focus does the same.
- [ ] Each layer card has a "?" button with an accessible name that opens and closes a legend popover; layers can register their legend content; the popover is not clipped in narrow windows and closes with Escape.
- [ ] Verified with a headless browser (no visible window): screenshots next to the prototype `.scratch/notation/prototype/index-hover-tilt.html`, differences listed in the review notes; packet positions sampled at two moments to prove motion; no console errors; the existing layouts (resizing, drawers) still work.
