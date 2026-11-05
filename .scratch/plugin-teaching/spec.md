# The teaching surface of a plugin: the Tutor can teach it, read it and test the person on it

Status: ticketed (2026-11-05), tickets in `issues/`

Source: the person's ideas of 2026-11-04 (the Tutor being able to use plugins is a must; the Tutor evaluates the person on a plugin, for example that they can use the Canvas and show they can lay out a given architecture), their confirmation on 2026-11-05 that it is **required** for plugins the Builder writes, ADR 0008, `.scratch/plugin-lessons/spec.md` (the lesson is the first part of this surface), and the Proposal mechanism that already exists for the authored layers.

## Problem

plugin-lessons lets a plugin explain itself, but the Tutor still cannot see what the person did inside a plugin, so it cannot tell whether they learned to use it; it can only ask questions about it. And nothing requires a plugin to make itself teachable. That was parked as "later" by mistake: the person wants it as part of what a plugin is.

## Solution

A plugin that can be taught declares a **teaching surface** in its manifest, with three parts:

1. **The lesson** (plugin-lessons): how to explain it.
2. **A read-only view of its state**: a named read the Tutor may ask for, returning plain data (for the Canvas: which Nodes and relations exist). It cannot change anything.
3. **Named checks**: each has a name, one plain sentence saying what it verifies, and an answer of yes or no with a short plain reason (for the Canvas: "a container with a relation to a database exists"). The Tutor runs a check after it asks the person to do something, and uses the answer to decide whether to move on or teach again.

The Tutor never acts inside a plugin. When something has to change inside a plugin, it makes a Proposal and the person accepts it, as with the authored layers (ticket 06).

## Decisions (agreed with the person)

1. **Required for plugins the Builder writes.** A plugin the Builder wrote that adds a Panel, a layer or other state of its own cannot be proposed for installing without a valid view and valid checks (and a lesson). A plugin with no state of its own (a theme, a guard rule) needs only its lesson.
2. **A warning for every other plugin** that lacks the surface or has a stale one. Never a block.
3. **Read-only by construction.** The view and the checks run with no way to write, start a process or reach the network; they have a time limit and a limit on the size of what they return. A fixture proves a view that tries to write is stopped.
4. **What a plugin returns is untrusted data to the Tutor**, like a lesson: the Tutor reads it and never follows instructions found in it.
5. **The surface is declared in the manifest and checked by the scan like everything else a plugin declares**, and is covered by the same staleness check as the lesson (plugin-lessons 03): a check that names something the plugin no longer has is a finding.

## Suggested slices

1. The manifest field and its validation (`docs/plugin-api.md` too).
2. The Tutor's two read tools: read a plugin's view, run a plugin's check.
3. The teach loop uses a check to judge a lesson part's `tryIt`.
4. The rule: required for Builder-written plugins, a warning for the rest; template and skill updated.
5. A real first example in a built-in plugin.
6. The Tutor proposes a change inside a plugin (needs a design of how a plugin applies an accepted Proposal).

## Not here

- Letting the Tutor change anything in a plugin without a Proposal.
- Scores or levels about the person: a check says whether something was done, nothing more (Tutor story 31).

## Open

- Whether the result of a check is recorded as Evidence for the Learner graph, which today holds answers only (agent's proposal: yes, as "did it", marked as coming from a check).
- Which checks a built-in layer such as the Canvas offers, and who decides them (the person, with the Tutor).
