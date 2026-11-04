# 14 - Confirmation dialog and plugin list look like the rest of aidea

Status: needs-triage (user feedback from the live check of 2026-11-04; do not block tickets 08-13)

## Problem

1. The Play confirmation uses `window.confirm` (`src/plugins/run/ui.js:36`): the browser's plain dialog, which does not match aidea's look. It lists the commands as raw text.
2. The plugin manager (`src/ui/features/03-plugin-manager.js`) is a flat list of rows with text buttons. The user wants it to feel like the VS Code Extensions view: developers know it, and it should feel like browsing a small marketplace, even though there is none.

## Wanted

- An in-page dialog built from the shared scale in `docs/agents/ui-style.md` (panel background, 12px radius, `--line` border, buttons as in the rest of aidea). Commands shown in `--mono`. Focus trap, Escape cancels, focus returns to Play. One component reused by every confirmation (this also closes the `window.confirm` gap listed in the handoff).
- Plugin list in the shape of the VS Code Extensions view:
  - Search box on top, sections "Installed" and "Waiting in the quarantine" (collapsible).
  - Each item: icon (letter tile if the manifest has none), title in bold, one-line description, publisher and version in `--muted`, and a small row of actions at the right (gear for Settings, Switch off / Switch on, Remove in a menu).
  - Click an item to open a detail view: description, capabilities it asks for, scan findings, settings, with a back arrow.
  - Quarantine items show a badge and an Install button with the scan findings in the detail view.
- Extend `ui-style.md` first if a role is missing (list item, badge, dialog).

## Reference (capture seen: `C:\Users\aleja\Downloads\vs.code.extensions.png`)

What the real Extensions view shows, to copy in spirit:

- Header row: title "Extensions" at left, refresh and "..." icons at right. Under it a search field ("Search Extensions in Marketplace") with a filter icon inside it.
- A dismissible warning strip above the lists (warning icon, text, "Show" link, X).
- Collapsible sections with a chevron, a name and a round count badge: "Installed 68", "Recommended 4".
- One item = a fixed-height row of two columns. Left: a 42px icon. Right: three lines: name in bold, one-line description cut with "...", then publisher with a small verified badge. At the far right of the third line: status icons (warning triangle, shield) and a gear. A load time ("309ms") sits at the right of the name line.
- A deprecated extension has its name struck through and a warning triangle.
- A not-installed item shows download count, a star rating and a small blue "Install" button (with a dropdown arrow) in place of the gear.
- Flat dark surface, no card borders between items, one hover highlight, one blue accent.
- Notifications are toasts at the bottom right: icon, message, blue primary button, grey secondary button, gear and X.

Mapping to aidea: Installed / Quarantine sections with count badges; the quarantine item takes the place of "Recommended" with an Install button; the scan warning takes the place of the warning triangle; the dialog for Play can be a toast-style panel with Accept / Cancel.

## Check

Page tests keep the current behaviours (confirm names each blocking finding, a bad setting is named, Required plugins cannot be removed). Full-screen captures on the second monitor before the commit, as `ui-style.md` asks.
