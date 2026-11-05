# Roles that cooperate, and the Contract as its own plugin

Status: draft, waiting for the person's read

Source: the person's remarks of 2026-11-05; ADR 0008 (roles with several instances); `src/core/contract.ts`, `src/core/drift.ts`, `src/core/plan.ts`, `src/core/routes/mcp.ts`, `src/ui/features/48-tutor-sections.js`.

## Problem

Checked in the code on 2026-11-05:

1. **The Tutor and the Builder cannot talk to each other.** The Tutor has tools to teach and to read and propose layers; the Builder has tools to read the Contract and to propose. Nothing lets the Tutor hand work to a Builder. A person who does not know how to ask the Builder for a plugin in Creator Mode, or for anything precise, has no help writing the request, and with several Builders and several Tutors it only gets worse.
2. **The Contract is the plan of the build, and nothing says so.** The Builder reads it (`read_contract`), but it is a list of what was agreed with no tasks, no owner and no progress, so several Builders cannot split it.
3. **The Contract and the Differences live inside the core and the Tutor's panel.** The Tutor knows them by name (the sections Plan, Differences, Contract of its panel), which is the opposite of what ADR 0008 and plugin-teaching ask: that the Tutor learn a plugin through the plugin's own teaching surface.
4. **Two things are called Plan.** The Tutor's Plan is a list of concepts to learn; the Contract is the plan to build. They need different names.

## Shape

### 1. Briefs: how one role asks another for work

A **Brief** is a short structured request: the goal in plain words, the context it rests on (references to Nodes, Contract items, plugins and lessons), constraints, acceptance checks (items of the Contract or named checks of a plugin's teaching surface), and the target (which Builder instance).

- The Tutor drafts a Brief when the person needs one. The person reads it, edits it and sends it. The kernel delivers it to the chosen Builder as its task.
- The Builder keeps its own permission mode: a Brief never widens what a Builder may do.
- **Creator Mode is the first case:** the person says what they want a plugin to do, the Tutor writes the Brief a Builder needs to build it properly (the plugin API, the template, the lesson and teaching surface required).
- The same channel can later run the other way: a Builder blocked on a decision asks for help and the Tutor teaches it to the person.
- Default: the person approves every Brief. Sending without approval could be offered per instance later, never by default.

### 2. The Contract as the plan of the build

Once the layers are complete the Contract is the plan, as in a plan mode: Builders work from it, and a departure goes through a Proposal as today. It gains **tasks**: each requirement becomes one or more tasks with a status, an owner (a Builder instance) and, for parallel Builders, a branch. The Differences become the progress of the plan and the drift from it.

### 3. The Contract as a plugin

The Contract moves out of the core and the Tutor's panel into a plugin that ships with aidea. It offers a service (the agreed items, the tasks, the differences), its own section, and a teaching surface (a lesson, a read-only view, named checks). The Tutor and the Builders use the service; the Tutor keeps no knowledge of Differences or the Contract in its own code.

## Depends on

The plugin system (built), plugin-teaching (the Tutor learns plugins through their surface), and Instances (several Builders and Tutors; briefs and tasks name an instance).

## Suggested slices

1. A Brief from the Tutor to one Builder: the format, a Tutor tool to draft it, a card to review and send, the Builder receiving it.
2. The Creator Mode Brief.
3. Extract the Contract and the Differences into a plugin, behaviour unchanged, the Tutor reading them through its service.
4. Tasks in the Contract, with status and owner; the Differences as progress.
5. Briefs and tasks with several Builders and Tutors (after Instances).
6. Rename the Tutor's Plan to "Learning plan".

## Open

- Whether the Tutor may ever send a Brief without the person's approval (proposal: no).
- Whether a Builder may ask the Tutor for help (proposal: later, same channel).
- The final name of the Contract-as-plan if "Contract" is thought to clash with the Contract of a software (proposal: keep Contract).
