# Interface style

The interface is plain CSS and JavaScript (ADR 0003). Its look comes from one scale of sizes and colours that every column shares: the Builder, the Canvas and the right slot (Tutor, Algorithms). A column that adds its own size or colour stands out from the rest, so a change to the look uses this scale and, when the scale is missing something, extends the scale first.

## Sizes

Defined by use in `src/ui/index.html` and the feature files. Pick the size by the role of the text.

| Size | Role |
|---|---|
| 11px | labels: uppercase, `letter-spacing: .08em`, `--muted` (the `h2` of a column, a card's kind) |
| 12px | secondary text: hints, descriptions, metadata, buttons inside cards |
| 13px | controls and diagram text |
| 13.5px | reading text: the chat, a question, an explanation, anything the person reads or answers |
| 14px | emphasis inside a card (a card title, a step title) |
| 15px | the app title (`h1`) |
| 22px and 26px | the Home screen only |

## Colours of text

Three tokens, with their contrast on the panels (all above the 4.5:1 minimum): `--text` (14.4:1) for what the person reads or answers, `--label` (11.3:1) for names and intermediate text, `--muted` (6.9:1 on `--panel`, 6.4:1 on `--raised`) for secondary text. Accent colours (`--accent`, `--authored`, `--derived`, `--danger`, `--unresolved`) carry meaning and are explained in the layer legends; they are not decoration. A text link (the Probe line, "Add what you thought") is `--accent-soft`, underlined, at the size of the text around it.

## Layout of a column

Text is left-aligned on one edge; a field, a button, a card and a section share the same width and the same margin on both sides; a card never touches the edge of its column.

## Checking a change

Before a commit that changes the look: take full-screen captures (the second monitor, `AIDEA_DISPLAY=secondary`, headless scripts for anything that needs a browser) of the three columns side by side, and compare sizes, greys and margins. The legend check (`test/legend-check.test.ts`) and the language-neutral text test (`test/language-neutral-text.test.ts`) must pass.

## Extending the scale

A role that no row covers gets a new row here, with its use, in the same commit that introduces it, and the other columns adopt it where they have the same role.
