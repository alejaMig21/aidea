# 01: Shared visual language: colour meaning, ambient motion and legends

**What to build:** The foundation every diagram layer uses, so the other tickets only add their own shapes. Colours get one meaning each on every layer (accent: active or in flight; teal: visited or derived; amber: authored; red: error or exception; grey dashed: unresolved or inferred) as named tokens. A small reusable motion kit draws arrows that flow in their direction, an element glow that breathes slowly (about 2.5 s), and a packet (a small glowing dot) that travels along any edge from source to target in a loop. A global "Animations" switch in the top bar turns all motion off; the system's reduce-motion setting starts it off; motion pauses while the window is hidden; unresolved edges never move. Hovering or focusing an element lights its incoming and outgoing edges and dims the rest. Each layer's Canvas card gets a "?" button that opens a legend popover (shapes, arrows, colours, and a "not shown" list) fed by the layer; the popover is closed by default. The kit is plain CSS and SVG with no library and is exercised on the existing drawings (for example the current Architecture arrows) so it is demoable on its own.

**Blocked by:** None (can start immediately)

**Status:** done

- [~] Colour tokens exist with one meaning each and are used by the kit; no layer redefines them.
- [~] A reusable way to mark an edge as flowing, an element as breathing and an edge as carrying packets, driven by data attributes or classes, with the packet following the edge's own path.
- [~] The "Animations" switch turns everything off and back on, is remembered between sessions, and starts off when the system asks to reduce motion; hidden-window pause works.
- [~] Unresolved (grey dashed) edges never animate.
- [~] Hover and focus light an element's edges and dim the rest; keyboard focus does the same.
- [~] Each layer card has a "?" button with an accessible name that opens and closes a legend popover; layers can register their legend content; the popover is not clipped in narrow windows and closes with Escape.
- [~] Verified with a headless browser (no visible window): screenshots next to the prototype `.scratch/notation/prototype/index-hover-tilt.html`, differences listed in the review notes; packet positions sampled at two moments to prove motion; no console errors; the existing layouts (resizing, drawers) still work.

## Review notes

Verified with a headless Chrome script (1440x900, 420x800), screenshots compared with `index-hover-tilt.html`, core started on the `studio` fixture:

- [x] Colour tokens: `--unresolved` added to `:root` next to the existing ones; `data-tone` maps each meaning once in `45-notation.js`; no layer redefines them.
- [x] Data attributes drive the kit (`data-flow`, `data-packets`, `data-breathe`, `data-tone`, `data-ends`); packets use `animateMotion` + `mpath` so they follow the edge own path. Applied to the Architecture/Business/Requirements connectors and the Components edges.
- [x] Animations switch in the top bar: off and back on, saved in localStorage (`aidea.animations`), survives reload, starts off under `prefers-reduced-motion`.
- [x] Hidden-window pause: simulated `visibilitychange` sets `motion-paused` and pauses SMIL; not observed with a really hidden window.
- [x] Unresolved (`data-tone="unresolved"`): dashed grey, no animation, no packets (checked computed style). No real unresolved edge exists yet, so this was checked by forcing the attribute.
- [x] Hover and keyboard focus light the Node edges and dim the rest (Architecture); Components Nodes are not focusable today, so only hover applies there.
- [x] "?" button with accessible name "Legend for <layer>", closed by default, Escape closes it, not clipped at 420 px wide. Layers register content with `notationRegisterLegend`.
- [x] Packet positions sampled 700 ms apart on Architecture: (556,301) then (556,346). No console errors besides the pre-existing `/favicon.ico` 404. `npm run typecheck` and `npm test` pass (155 pass, 1 skipped).

Differences from the prototype: packets have no outline ring and the glow is slightly smaller; the switch is a button (`aria-pressed`) not a checkbox; no "Quiz me" or step mode (out of scope here); legend is one popover on the Canvas card, not per panel; flow dashes apply to every connector including plain parent-child ones, as in the prototype; Fit now measures the world without packets (they sit at the origin until they move).

`[~]` = closed as done without this check being recorded at the time; not re-verified (cleaned up on 2026-10-30, history in git).
