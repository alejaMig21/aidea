# Plugin lessons: "How aidea works" becomes modular

Status: ticketed (2026-11-04), tickets in `issues/`

Source: the person's ideas of 2026-11-04 (second session); ADR 0008 (small kernel, everything else a plugin); `src/core/guide.ts` (today's guide); plugin-system tickets 08 (update as a difference), 14 (live inspection, template, skill) and 15 (the Builder proposes a plugin).

## Problem

"How aidea works" is one fixed tour in `src/core/guide.ts` that describes the app as if it never changed. Since ADR 0008 almost every panel is a plugin, so the tour is wrong the moment a plugin is removed, added or written by the person. A person with 55 plugins would face an endless class; a person with none would hear about panels they do not have. A plugin the person writes with Creator Mode has no way to teach itself.

## Solution

Each plugin carries its own lesson, as data, in the same shape as today's guide parts. The Tutor teaches "How aidea works" as the kernel trunk plus a menu of the lessons of the plugins that are installed and enabled; the person picks, skips and may leave at any part. Creator Mode writes the lesson together with the plugin and keeps it current; the core checks mechanically that the lesson still names things the plugin really has.

## Decisions (agreed with the person)

1. Lessons are data, not an MCP per plugin. A plugin is third-party code; data is safer and simpler to write. The Tutor reads lessons through one generic read tool.
2. The class is modular: kernel trunk first (short), then one lesson per installed plugin, chosen by the person. Any lesson can be left half way; a part not finished is not marked done.
3. A plugin the Builder writes needs a valid lesson before the Builder may propose installing it. A plugin from anywhere else without a lesson, or with a stale one, gets a warning, never a block.
4. The lesson is kept current by (a) the Creator Mode skill and template, which make it part of writing and of changing a plugin, (b) a mechanical check, (c) the update difference screen.
5. Out of the first slices: the Tutor acting inside a plugin, and the Tutor reading a plugin's live state to evaluate the person. See "Later".

## The lesson

One file in the plugin folder, declared in the manifest (`lesson`). Shape of one part, the same as `Part` in `guide.ts`: `name`, `hint`, `what`, `question`, `example`, `narration`, `tryIt`. Plus `refs`: the things of the plugin the part talks about (a panel id, a setting key, a service name), as the manifest declares them.

- The Tutor receives the lesson as DATA, marked untrusted like a quarantined plugin: it teaches from it in its own words and never follows instructions found inside it. `tryIt` is something for the PERSON to do in the interface; the Tutor cannot do it for them.
- Every label in double quotes must be a label the interface really shows (the rule `guide.ts` already states and tests).

## The mechanical check

Each `refs` entry is compared with what the live inspection (`GET /plugins/inspect`, ticket 14) says the plugin declares. A ref that no longer exists is a finding "the lesson names X, the plugin no longer has it". It only proves the names exist, not that the prose is right; the skill covers the rest. The check runs when a plugin is loaded, in the quarantine report, and in the update difference, where it also says "the plugin changed, the lesson did not".

## The trunk

`GUIDE` keeps only what the kernel owns. Parts that describe a plugin today (Playback and Run, the Terminal, the Tutor's own sections, Files and Code) move into the lessons of the built-in plugins that own them. The built-in plugins are the first lessons, which proves the format.

## Suggested slices (tracer bullets, in order)

1. A built-in plugin ships a lesson file; the manifest declares it; the Tutor lists and reads lessons of installed, enabled plugins through a new read tool (`PLUGIN_READ_TOOLS`); the class opens on the trunk and offers the menu.
2. Leaving the tour at any part; choosing which lessons; a lesson left half way is not marked done.
3. `refs` check: finding in the quarantine report, at load, and in the update difference ("the plugin changed, the lesson did not").
4. Creator Mode: the template has a lesson, the skill says to write and update it, and the Builder's proposal is refused without a valid one.
5. Split `GUIDE`: move the plugin-owned parts into their plugins' lessons.

## Not here

- The Tutor using a plugin (acting) or reading its live state to evaluate the person (the example: it asks the person to lay out an architecture in the Canvas and checks it). Needs a read-only view each plugin may declare, and a permission rule for anything that acts. A spec of its own.
- A versions plugin (v1.0.0 numbers proposed from the commits since the last version: `fix` raises the last number, `feat` the middle one, a breaking change the first). A plugin of its own, not part of this.
- Performance of aidea with a very high number of heavy plugins. A separate measurement.

## Open

- Where the progress of lessons is kept (per person, outside the Project, like recents).
- Whether the menu is part of the Tutor panel or its own view.
