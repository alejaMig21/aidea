# Electron smoke report (real shell, second monitor)

Run: Electron 45 / Chrome 156, `AIDEA_DISPLAY=secondary`, isolated `AIDEA_RECENTS_FILE` / `AIDEA_PREFERENCES_FILE`, CDP on 9333, driven with playwright-core. No source file edited. Electron and every node core were killed by PID at the end; port 9333 is closed; temp dirs and `.scratch/electron-smoke/` deleted.

Display note: the mission said "abort if screenX < 1920". Real geometry: the primary is 1920x1080 physical at 125% scale = 1536x864 DIPs, so the second display starts at screenX = 1536 in Chromium coordinates. Window opened at screenX=1536, screenY=0 (Win32 rect L=2400 in the scaled space = DISPLAY2 origin). Window was on the second display on the first check and after every resize (I kept every resize at the DISPLAY2 origin via Win32 SetWindowPos because Electron does not implement `Browser.getWindowForTarget` / `Browser.setWindowBounds`).

## Checklist

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Opens on second display | PASS | `screenX=1536 screenY=0`, 1280x800; Win32 rect on DISPLAY2 |
| 1 | No default menu | PASS | Win32 `GetMenu=0`; outer-inner height diff is only the title bar |
| 1 | No console window | PASS | Core `node.exe` has no window handle; only the `aidea` window exists |
| 1 | Minimum size enforced | PASS | Asked for 400x300, got outer 720x520 (inner 704x481) |
| 2 | Home full window, recents with relative times | PASS | Home rect = 1264x761 (whole viewport); "Opened 5 min ago / 3 hours ago / 2 days ago", then absolute dates (10/19/2026) beyond a week |
| 2 | Forget on hover | PASS | `.forget` opacity 0 -> 1 on hover |
| 2 | Open folder button + `window.aidea.pickFolder` | PASS | button present, `typeof window.aidea.pickFolder === "function"`. Native dialog NOT TESTABLE (not triggered) |
| 2 | New project with typed parent creates folder and opens it | PASS | temp parent + "smoke-new": folder created on disk, Home hidden, switcher shows `smoke-new` |
| 3 | Open a recent | PASS | studio-c4, playback, relations, flow, studio-requirements all opened |
| 3 | Switcher popover | PASS | CURRENT = open project; RECENT lists the rest without repeating the current one; "Open folder..." and "Home" present; Esc closes |
| 3 | Home reachable and back | PASS | Home via switcher, back via recent |
| 4 | Fold/unfold chat and right | PASS | chat folded: canvas 8-897; both folded: canvas 8-1256 (fills window); unfolding restores 8-286 / 294-968 / 976-1256 |
| 4 | Drag separator | PASS (small imprecision) | `#sepc` +100px: chat edge 286 -> 374 (+88); `#sepr` -50px: right 280 -> 334 wide. Edge lags the pointer by about 12px |
| 4 | Sizes persist after reload | PASS | `aidea.layout` in localStorage (`chat 509.68, right 494.38`) restored after `location.reload()` |
| 4 | Narrow: 800 / 760 / 720 | PASS | inner 784: right auto-folds, chat stays. inner 744 and 704: both panes folded, `narrow` class, buttons use `aria-expanded`; chat drawer 360 wide, right drawer 336-696; Esc closes each |
| 5 | Business: nine blocks, hints | PASS | 9 `.bblock` + numbered 1-9, hover card (title, meaning, "Ask yourself", "Example"), Esc hides it |
| 5 | Credit line + link | PASS (with caveat) | `<a target=_blank rel="noopener noreferrer" href=https://creativecommons.org/...>`. I did NOT click it: `shell.openExternal` would open the person's default browser on the main monitor. Instead I drove the same `setWindowOpenHandler` with a `target=_blank` anchor and `window.open` from an iframe to non-http URLs: 0 new pages/popups, `/json` still 1 target, main URL unchanged. The https branch (openExternal) is code-read only |
| 5 | Walk me through it | PASS | Step 1..9 of 9 (Customer Segments ... Cost Structure), Back disabled on 1, "Finish" on 9, Back works, Close hides; one `.bwalk-now` per step (two on step 2: block + note) |
| 5 | Requirements | PASS | FUNCTIONAL and NON-FUNCTIONAL group headers, USER STORY / NON-FUNCTIONAL cards with PERFORMANCE tag. Fixture has deliberate invalid nodes, so a red validation block overlaps the top of the layer (see Bugs 3) |
| 5 | Architecture | PASS | Person / Container / External System boxes, 6 edges with labels ("Builds quotes with [HTTPS]", "Reads and writes quotes [SQL]", ...), dashed external system |
| 5 | Components | PASS | relations: 3 packages (render, shapes, util), 3 `?` unresolved edges (getattr, callback, handler), resolved/inferred/unresolved edges, imports/calls/inherits |
| 5 | Algorithms (ops.drain) | PASS | dblclick opens the flowchart: stadium, rectangle, diamond (polygon); Record a run with total=135 -> 17 steps, `total 95, steps 4, returns 4`; step/play/pause/slider work; token `cy` 20 -> 47 -> 62 -> 100 (moves along the edge); Algorithms tab disabled until a function opens, enabled after, disabled again after switching project |
| 6 | Animations switch | PASS | `body.motion-off` toggles, label "Animations: on/off", `localStorage aidea.animations` = off |
| 6 | Packets move | PASS | Architecture packets at t0 `[[431,328],[491,381],[428,381]]`, +900 ms `[[431,321],[524,381],[415,380]]`; with Animations off the packets are not rendered (rects 0,0) |
| 6 | Legend `?` + Esc on each layer | PASS | business, requirements, architecture, components, algorithms: opens (`aria-expanded=true`), closes with Esc |
| 7 | Model / permission selects | PASS | Model: Default/Sonnet/Opus/Haiku; Mode: Manual/Accept edits/Plan/Auto |
| 7 | Choice persists, stored per project | PASS | studio-c4 set to sonnet + acceptEdits; prefs file `{"...studio-c4":{"model":"sonnet","mode":"acceptEdits"}}`; survives reload; `flow` still default/default; back in c4 still sonnet |
| 7 | Tutor empty state + model select | PASS | "The Tutor is not available yet", select present, "Start a class" disabled. No chat message sent |
| 8 | Proposals and permission cards | NOT TESTABLE | need the builder (cost) |
| 9 | Console errors / crash | PASS (with 1 finding) | 0 `pageerror`, 0 renderer crashes, no console errors in normal use. The only errors came from my own `window.open` probe (Bugs 1) |
| 10 | Electron vs Chrome | see below | |

## Differences from plain Chrome

- Fonts: Inter and JetBrains Mono load from `/fonts/` served by the core (`document.fonts` status `loaded` for both); no network needed.
- Preload API: `window.aidea.pickFolder` exists only in Electron. In Chrome the Home "Open folder" button falls back to the typed path.
- localStorage works (`aidea.layout`, `aidea.animations`) and survives reload. Not tested across a full app restart. Electron's profile is `%APPDATA%\aidea` (not the person's `~/.aidea`).
- Window size/position cannot be changed through CDP (`Browser.getWindowForTarget` not found); resizing needs the OS (I used Win32). Minimum 720x520 outer means the content area never gets below 704x481.
- `window.open` handling: `setWindowOpenHandler` denies everything and only forwards `http(s)` to the OS browser. Verified deny path; no new Electron window.
- `location.reload()` returns to Home (no project is restored), only layout/animation state is restored.

## Bugs found (ranked)

1. Low, latent: the global function `open(path)` in `src/ui/features/00-canvas.js` shadows `window.open`. Any call `window.open(url)` from page code (or a third-party script) POSTs `/projects` with `{path:url}` and gets a 400 instead of reaching Electron's `setWindowOpenHandler`. Anchors with `target=_blank` (the CC BY-SA credit link) are not affected. Repro: devtools console `window.open("about:blank")` -> `POST /projects 400 {"error":"path must be an existing directory"}`. Fix idea: rename it (e.g. `openProject`).
2. Low, cosmetic: at the default 1280x800 window the layer bar is clipped under the legend `?` button ("Algorithm" / "Cor" cut off). It scrolls horizontally, so nothing is lost. Repro: open any project at 1280 wide, Business or Algorithms layer.
3. Low, cosmetic: with an invalid `requirements.json` (fixture `studio-requirements`), the red validation message block is drawn over the top of the canvas, overlapping the "FUNCTIONAL" header and the first card. Repro: open studio-requirements, Requirements layer.
4. Very low: separator drag lags the pointer by about 12px (chat +100px moved the edge +88px). Repro: drag `#sepc` 100px right at 1280 wide.
5. Very low: right after opening the switcher, the list may still show the previous project as CURRENT for a moment (I read it immediately after opening on one run; after 600-800 ms it was correct). Likely the fetch race; not reproduced when waiting.

## Not testable

- Native folder dialog (`pickFolder`), by instruction.
- Clicking the credit link to confirm `shell.openExternal` actually launches the default browser (it would open a window on the person's main monitor). Only the deny path and the anchor attributes were verified.
- Proposals and permission cards (need the builder).
- Persistence across a real app restart; the Home folder-forget click itself (hover only; not clicked to keep the recents seeded).
- Setting window bounds through CDP (not supported by Electron), so resizes were done with Win32 `SetWindowPos`, always at the DISPLAY2 origin.
