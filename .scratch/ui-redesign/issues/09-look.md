# 09: The look

**What to build:** The whole interface gets the chosen look: dark theme, Inter for text and JetBrains Mono for code shipped with the application so it looks the same offline, accent blue, amber for authored Layers, teal for derived Layers, dashed accent outline for Proposals. Real buttons and labels, visible focus rings, text contrast of at least 4.5:1, and every button, tab and field reachable and labelled from the keyboard.

**Blocked by:** 05, 08

**Status:** done

- [ ] Fonts load with no internet connection.
- [ ] Text, borders and focus rings are legible everywhere; text contrast is at least 4.5:1.
- [ ] Every button, tab and field is reachable by keyboard and has an accessible label.
- [ ] A Proposal is visibly different from an accepted Node (dashed accent outline).
- [x] No new framework is introduced (plain JavaScript and CSS).
- [ ] Checked live on Home and on the work session; result noted in the ticket.

## Review notes

Verified (none live): `npm run typecheck` and `npm test` pass (143 tests, 142 pass, 1 skipped, 0 fail), including a new protocol test: `GET /fonts/inter-latin-wght-normal.woff2` answers 200 as `font/woff2`, and other names (`OFL-Inter.txt`, a traversal attempt) answer 404.

What changed:
- Dark only: the `prefers-color-scheme` block is gone, `color-scheme: dark`. Tokens live in `:root` of `index.html`, with new `--control`, `--accent-strong`, `--danger`, `--sans`, `--mono`.
- Fonts: Inter and JetBrains Mono (latin variable woff2 from `@fontsource-variable/*` 5.3.0, fetched with `npm pack` into a temp dir; not in package.json) are in `src/ui/fonts/` with both OFL texts. `@font-face` with `font-display: swap` loads them from `/fonts/`, served by `src/core/routes/ui.ts` (only plain `*.woff2` names present in the folder).
- Hard-coded reds and `ui-monospace` replaced by tokens. Global `:focus-visible` accent ring.
- Proposals: "update" Proposals were solid; all Proposals are now dashed accent outlines. Accepted Nodes keep a solid quiet stroke.
- DOM order now matches the visual order (side, chat, separator, Canvas, separator, right slot), so Tab goes left to right.
- Labels and roles added: Projects aside, fold buttons group, right-panel tablist label, right region, Layers group (the Layer buttons are toggles with aria-pressed, so they stay buttons, not tabs). Already present: right-slot tablist/tab/tabpanel/aria-selected, fold aria-pressed, switcher aria-expanded, labels on the chat, path, Tutor and rejection-reason inputs.

Contrast (WCAG ratios, computed with a throwaway script): text on bg 15.9, text on panel 14.7, muted on bg 7.6, muted on panel 7.0, accent on bg 7.3, accent on panel 6.7, white on accent-strong (buttons) 5.7, authored on panel 8.6, derived on panel 7.8, danger on bg 8.2, text on module/class/function fills 9.8/9.5/9.0, text on active Layer tab 10.3 (authored) and 10.6 (derived). Non-text: control borders 4.1 on bg and 3.8 on panel; dividers (`--line`) are 2.1 on purpose, they are decoration. Near-miss: muted text on the class fill is 4.52 (accent on the module fill, 4.48, is not used for text).

Needs live checking (left unticked): fonts actually render offline in the window (only the serving is tested); every surface looks right in the new palette on Home and on the work session; focus rings are visible on each control, including the SVG Proposal nodes; Tab order feels sensible; the dashed Proposal outline is visibly different from an accepted Node on all three authored Layers; no layout shift from the font swap.
