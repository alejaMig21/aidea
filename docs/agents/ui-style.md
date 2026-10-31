# Interface style

The interface is plain CSS and JavaScript (ADR 0003). Its look comes from one scale of sizes and colours that every Panel shares: the Builder, the Canvas, Run and the Tutor. A Panel that adds its own size or colour stands out from the rest, so a change to the look uses this scale and, when the scale is missing something, extends the scale first.

## Sizes

Defined by use in `src/ui/index.html` and the feature files. Pick the size by the role of the text.

| Size | Role |
|---|---|
| 11px | labels: uppercase, `letter-spacing: .08em`, `--muted` (the `h2` of a Panel, a card's kind) |
| 11px, `--accent` | the name of the phase of a question card (Predict, Review of an earlier class): uppercase, same letter-spacing |
| 12px | secondary text: hints, descriptions, metadata, buttons inside cards |
| 12.5px, `--mono`, line height 1.6 | code text: the source lines of the Code panel, the values and output of Playback |
| 13px | controls and diagram text |
| 13.5px | the title of a Panel (Builder, Run, Tutor) |
| 13.5px | reading text: the chat, a question, an explanation, anything the person reads or answers |
| 14px | emphasis inside a card (a card title, a step title) |
| 15px | the app title (`h1`) |
| 22px and 26px | the Home screen only |

## Colours of text

Three tokens, with their contrast on the panels (all above the 4.5:1 minimum): `--text` (14.4:1) for what the person reads or answers, `--label` (11.3:1) for names and intermediate text, `--muted` (6.9:1 on `--panel`, 6.4:1 on `--raised`) for secondary text. Accent colours (`--accent`, `--authored`, `--derived`, `--danger`, `--unresolved`) carry meaning and are explained in the layer legends; they are not decoration. A text link (the Probe line, "Add what you thought") is `--accent-soft`, underlined, at the size of the text around it.

## Layout of a Panel

Text is left-aligned on one edge; a field, a button, a card and a section share the same width and the same margin on both sides; a card never touches the edge of its Panel.

A tree (Files) has rows 26px tall, each level indented 14px more, names at 13px and the language tag at 12px in `--muted`; names of ignored or unreadable entries are `--muted` too, ignored ones in italics.

Source text (the Code panel) may use three syntax colours, `--syn-keyword`, `--syn-string` and `--syn-number`, and `--muted` for comments. They are for text inside code only and carry no meaning; they are not used anywhere else.

## Checking a change

Before a commit that changes the look: take full-screen captures (the second monitor, `AIDEA_DISPLAY=secondary`, headless scripts for anything that needs a browser) of the Panels side by side, and compare sizes, greys and margins. The legend check (`test/legend-check.test.ts`) and the language-neutral text test (`test/language-neutral-text.test.ts`) must pass.

## Extending the scale

A role that no row covers gets a new row here, with its use, in the same commit that introduces it, and the other Panels adopt it where they have the same role.
