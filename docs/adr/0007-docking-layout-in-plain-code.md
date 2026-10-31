# The docking Layout is built in plain code; a docking library is not adopted yet

**This is a recommendation for the person to confirm.** It amends ADR 0003; it does not replace it. It was written by the agent from a throwaway prototype (`.scratch/layout-and-data/spike-07/`) and nothing in the interface changes until the person agrees.

ADR 0003 said that if plain code cannot reach the smoothness needed for resizable, foldable Panels, adopting a framework is the expected next step. Ticket layout-and-data/07 tested that on the hardest cases of a Unity-like Layout: resize by dragging, side by side and stacked, nested, tabs, drag a Panel by its title to a new place with a landing preview, serialise to JSON and restore. The same six stand-in Panels (Builder, Files, Code, Canvas, Run, Tutor, with heavy content: 2,000 code lines, 500 SVG nodes, 300 chat cards) were put into (a) about 100 lines of plain JavaScript and (b) `dockview-core` 8.8.3, the one candidate chosen. Chosen because it is MIT, needs no React and no build step (one script file), and is maintained (thirteen releases in the last month, the last on 2026-10-30); the only other framework-free candidate found, golden-layout 2.6.0, is MIT but has had no release since February 2023.

**Recommendation: build the docking Layout in plain code (ticket 08) and keep ADR 0003's no-framework rule.** Plain code met the smoothness criterion with no help, costs about 3 KB, and gives full control of the three things ADR 0003's own consequences already promise to test: feel, size and the Panel model of the Panel registry (ticket 18). The library is better at exactly one thing that the plain prototype did not build, the second window (stories 43 to 45). If the person wants that in the first docking release, adopt `dockview-core` instead; see "When this changes".

## What was measured

Headless Chrome (playwright-core), 1920 by 1080, mouse moved in 60 to 80 steps at 16 ms. Two full runs: 1x CPU and 4x CPU throttling (a stand-in for a weak laptop). Frame times are `requestAnimationFrame` gaps; 16.7 ms is a perfect frame.

| | Plain JS | dockview-core |
|---|---|---|
| Added code | 7.8 KB, 3 KB gzip | 561 KB, 106 KB gzip (166 KB of it is CSS the library injects) |
| Page load with the six Panels (1x / 4x) | 131 / 627 ms | 270 / 1,435 ms |
| Drag a splitter, frames over 25 ms, 1x | 0 of 136 | 0 of 137 |
| Drag a splitter, frames over 25 ms, 4x | 0 of 167 (first run: 10 of 195) | 10 of 192, worst frame 50 ms (first run: 21 to 31 of about 190, worst 117 ms) |
| Drag a splitter back, 4x | 0 of 173 (first run: 3 of 199) | 24 of 229 (first run: 46 to 61, worst 67 ms) |
| Drag a Panel title across nested splits, stack, tab, nest, 1x and 4x | 0 frames over 25 ms in all four moves | 0 frames over 25 ms in all four moves |
| Landing preview while dragging | shown in all four moves | shown in all four moves |

Drag moves are smooth in both. The splitter is where they differ: at 1x both are perfect; under 4x load the library drops frames on every run, plain code on one run out of two. Layout work during a splitter drag was about twice as high in the library (533 ms against 192 ms of layout time for one 300 px drag at 4x). Caveat: the library's drags use the browser's native drag and drop, which Playwright only simulates, so its Panel-drag numbers are a lower bound.

## How much of stories 29 to 48 each covers

| Story | Plain (prototype) | dockview-core (free, MIT) |
|---|---|---|
| 30, 31, 32 resize, side by side, stacked, nested | yes | yes |
| 33 tabs | yes (no reorder inside a tab group, no tab overflow) | yes, with reorder and overflow |
| 34 drag by title with landing preview | yes | yes |
| 35 minimum sizes | yes: no Panel went below its minimum, even when pushed | yes, but counted with the 8 px gap: a declared 268 left the card 261 wide, so every minimum must be padded by the gap |
| 36 to 41 serialise and restore | yes: 338 bytes of JSON, restored sizes identical to the pixel | yes: 1,316 bytes, sizes within 1 px |
| ticket 18: an unknown Panel id is ignored on load | yes, filtered on load | no: the restore throws, rolls back and leaves an empty window (0 Panels). We would filter the JSON ourselves first |
| 43 to 45 second window | not built (see below) | yes: `addPopoutGroup` moved Run into a second window and brought it back when that window closed (headless Chrome; Electron not tried) |
| 46 narrow window: drawers | not built, not provided by either | not provided |
| 48 keyboard | splitter focusable with arrow keys (547 to 527 px); tabs are buttons; moving a Panel by keyboard not built | splitters are not focusable at all; tab arrows work; keyboard navigation and keyboard docking exist but ship in `dockview-enterprise`, whose npm licence is "SEE LICENSE IN LICENCE.md" (not permissive on its face; not evaluated further) |
| 29 show and hide | trivial (drop from the tree) | `removePanel` and `addPanel`; every tab also gets a close button by default |

## Fitting the existing cards and `docs/agents/ui-style.md`

- **Cards.** Both took the existing card DOM as it is. dockview: 27 lines of glue (one `createComponent` returning the card's element) plus `defaultRenderer: "always"`, because the default unmounts hidden tabs and would lose the chat scroll and the Canvas zoom. Plain: the card element is appended to a group. In both, the grid, separators and drawers of `src/ui/features/07-layout.js` are replaced, not reused, and the narrow-window drawers have to be rewritten either way.
- **Style.** Plain code uses the existing tokens and the 13.5px title row directly. The library ships 4,314 lines (166 KB) of its own CSS with its own colour variables, tab sizes and a drop overlay; matching the scale needed 26 lines of overrides (`dock.html`) and still left its close buttons and tab geometry, which are a new control and a new size outside `ui-style.md`. Every theme change then fights the library's variables.

## Considered Options

- **Adopt `dockview-core` now.** Fewer lines to write for tabs, reorder and the second window. Costs: +106 KB gzip, a dependency that we would vendor so the app needs no network, a restore that fails whole on one unknown id, no keyboard resize, keyboard docking only in a non-permissive package, and a measurable drop in splitter smoothness on slow machines.
- **Build in plain code (recommended).** About 100 lines covered stories 30 to 35, 40 and 41, with margin on smoothness. Costs: we write and own reorder inside tabs, tab overflow, resizing that pushes neighbours (the library does this; ours only moves the two sides of the border), keyboard moving of Panels and the second window.
- **golden-layout 2.** Not tried: no release since 2023.

## Consequences

- ADR 0003 stands for the Layout: the docking engine is plain JavaScript on the Panel registry of ticket 18 (a Panel is an id, a title and a minimum size; the engine needs nothing else). Ticket 08 builds it and measures it again on the real window.
- The second window (stories 43 to 45) is a separate piece of work after 08, not part of it, because the prototype did not settle its cost in plain code. In the library's popout the Panel's DOM moves into a window opened by the same page, so it keeps the same JavaScript context; plain code would have to do the same move and open the window under Electron's rules, which is the part that was not built.
- The serialised Layout is a small tree of splits and groups of Panel ids with sizes (the shape in the prototype is a good starting point for ticket 09), and unknown ids are dropped on load.
- Minimum sizes live in the registry and are enforced by the browser (`min-width` on each cell), so they cannot be bypassed by dragging.

## What could not be measured

- The real Electron window, and real mouse input (headless Chrome with simulated mouse; the library's native drag and drop is only simulated).
- The cost of the second window in plain code, and the cost of dockview's popout window under Electron's window-open rules.
- Long-session behaviour, memory use, and the licence text of `dockview-enterprise`.
- A person's feel of the drag; the frame numbers say nothing about how it feels in the hand.

## When this changes

Adopt `dockview-core` (or revisit) if the person wants the second window in the first docking release, or if ticket 08 measured on the real window shows the plain splitter or Panel drag dropping frames at 1x.
