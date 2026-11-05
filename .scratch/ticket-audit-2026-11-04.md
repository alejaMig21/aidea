# Ticket audit, 2026-11-04

> Superseded for ordering by `.scratch/backlog.md` (2026-11-05), which lists everything by dependency. This file stays as the record of the audit; its section "Order of work that follows" no longer applies.

149 tickets in 15 folders under `.scratch/*/issues/`, read against what was decided up to today: ADR 0008 (small kernel, everything else a plugin), the removal of Class mode, Direct mode and the decision classes (58d676d), Flow and Code renames (layout-and-data 01 and 04), dockview, the plugin lessons draft (`.scratch/plugin-lessons/spec.md`), and the person now working on one screen and testing in Vivaldi. This is a reading of headers, boxes, dates and the code that exists, not a re-test of every ticket.

## 1. Up to date (about 107): nothing to do

`done` or `resolved`, every box ticked, and still true.

- notation 01-13, ui-redesign 01-14, polish 01-05, real-projects 01-09 (09 is closed as not a bug), run-in-plain-words 01-02, storage-per-node 01-02.
- aidea-v1 01-09; language-adapters 01-04; tutor 01-06, 08, 09, 11, 12, 14; tutor-column 01.
- layout-and-data 01-06, 08, 09, 11-16, 18, 19.
- live-findings 02, 03, 06, 07, 08; run-and-terminal 08, 09, 11-14.
- v1-gaps 02-10, 12.

## 2. Obsolete: do not work on them

| Ticket | Why | State of the file |
|---|---|---|
| live-findings 04 (decision class missed) | decision classes were removed | already says "Moot" |
| v1-gaps 11 (layer bar clipped) | Code is a Panel now | already says superseded |
| aidea-guide 01, last box (live check) | its design is replaced by plugin lessons | marked today; button, quick tour and protocol stay as the trunk |
| tutor 10 (decision classes) | feature removed | says `done`, no note: needs the note |

## 3. Needs an update

### 3a. The header says "ready-for-agent" but the work is done (mechanical)

- plugin-system 01-17: all boxes ticked, code and live checks exist. The folder `spec.md` too.
- run-and-terminal 01-03: all boxes ticked. 04-07 have 1 or 2 unticked boxes each, all "tests pass" or small page checks; the tests exist (`plugin-run.test.ts` covers recipe, order, ready signals, stop in reverse; `terminal-panel*`, `run-recipe-page`). Tick after one look at the two page boxes (Terminal hidden stays hidden; the failure message offers the Terminal). The folder `spec.md` too.
- `spec.md` of aidea-v1, notation, tutor, ui-redesign and layout-and-data still say ready-for-agent; the first four are built, layout-and-data has 10 and 17 open.

### 3b. The text predates a decision

| Ticket | What is out of date | Update |
|---|---|---|
| tutor 07, 13, 15, 16; tutor-column 02; aidea-v1 17 | name Class mode and Direct mode | one line at the top: "Class and Direct mode were removed in 58d676d; read as history" |
| layout-and-data 10 (Panel on another monitor) | the person has one screen; panels now come from plugins too | status "on hold: needs a second screen"; add that a plugin's Panel can be moved out as well |
| layout-and-data 17, last item | "the layer class for Data teaches with its own help" now belongs to plugin lessons | point it to `plugin-lessons`; keep only the Tutor tags on Data elements here |
| layout-and-data 07 | resolved, two boxes left open | tick them or write "decided, not needed" |
| language-adapters 05 (run TS/JS) | `needs-info` since 10-29; the run recipe and plugin Run now exist | write the question again for the person: how is a JS function run safely |
| live-findings 01, 05 | live checks say "second monitor" | say "main screen, Vivaldi" |

## 4. Waiting for a live check with the real Claude (they spend quota)

live-findings 01 (idea names), live-findings 05 (waits of 3, 10 and 30 minutes), run-and-terminal 10 (the Builder proposes a recipe), v1-gaps 01 (the Builder cannot write aidea files except through Proposals). Done today with the real Builder: live-findings 07 and storage-per-node 02.

## 5. New and not yet in tickets

- `.scratch/plugin-lessons/spec.md` (draft): waits for the person's read, then `/to-tickets`.
- Ideas for later, not tickets: the Tutor acting in or reading a plugin; a versions plugin (semver from commits); aidea with very many heavy plugins.
- `.scratch/future/ideas.md` still lists "The Tutor teaches aidea itself" as a plain idea and mentions Class mode; `interviews-pending.md` was not read in this audit.

## Order of work that follows

1. Apply 3a and 3b (documents only, one commit).
2. `/to-tickets` on plugin-lessons (the person types it).
3. layout-and-data 17, last item (Tutor tags on Data elements).
4. The four live checks of section 4, in one sitting.
5. language-adapters 05 once the person answers.
6. layout-and-data 10 when there is a second screen.

## Applied (2026-11-04)

Step 1 is done: 3a and 3b were written into 45 files (headers, notes at the top of the history tickets, a few boxes ticked where a test exists, two left open on purpose: run-and-terminal 06 failure message, 07 buttons page test). live-findings 04 now says obsolete. The next steps are the ones listed above.

## Correction (2026-11-04)

Section 3b said language-adapters 05 was `needs-info` and waited for the person. That was wrong: it was decided on 2026-11-03 (`.scratch/future/interviews-pending.md`, section 7, which this audit had not read). The ticket now says so. Section 5 also missed the pending items listed in `.scratch/backlog.md`.
