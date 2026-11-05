# Roles that cooperate, and the Contract as its own plugin

Status: draft, waiting for the person's read

Source: the person's remarks of 2026-11-05; ADR 0008 (roles with several instances); `src/core/contract.ts`, `src/core/drift.ts`, `src/core/plan.ts`, `src/core/routes/mcp.ts`, `src/ui/features/48-tutor-sections.js`.

## Problem

Checked in the code on 2026-11-05:

1. **The Tutor and the Builder cannot talk to each other.** The Tutor has tools to teach and to read and propose layers; the Builder has tools to read the Contract and to propose. Nothing lets the Tutor hand work to a Builder. A person who does not know how to ask the Builder for a plugin in Creator Mode, or for anything precise, has no help writing the request, and with several Builders and several Tutors it only gets worse.
2. **The Contract is the plan of the build, and nothing says so.** The Builder reads it (`read_contract`), but it is a list of what was agreed with no tasks, no owner and no progress, so several Builders cannot split it.
3. **The Contract and the Differences live inside the core and the Tutor's panel.** The Tutor knows them by name (the sections Plan, Differences, Contract of its panel), which is the opposite of what ADR 0008 and plugin-teaching ask: that the Tutor learn a plugin through the plugin's own teaching surface.
4. **Two things are called Plan.** The Tutor's Plan is a list of concepts to learn; the Contract is the plan to build, and Builders also have a plan mode. Optional: rename the Tutor's Plan to "Learning plan".

## Shape

### 1. Briefs: how the person asks a Builder for work, taught by the Tutor

A **Brief** is a short structured request to a Builder: the goal in plain words, the context it rests on (references to Nodes, Contract items, plugins and lessons), constraints, acceptance checks (items of the Contract or named checks of a plugin's teaching surface), and the target (which Builder instance).

**The principle (the person, 2026-11-05): the Tutor is there to teach, it has no autonomy over the Project, the person has it.** So the Tutor never sends anything to a Builder. When a Brief is needed it does what LearnHarness does with any skill: it turns it into a lesson. It explains what a good request has and why, and the person writes the Brief in their own words first (the co-authoring pattern of tutor 08); the Tutor checks it against the parts above, says what is missing, and may offer a better version as a Proposal the person accepts or not. The only thing that sends a Brief to a Builder is the person's own button. There is no auto-send, not even optional.

- The kernel delivers the Brief the person sent to the chosen Builder instance as its task. The Builder keeps its own permission mode and the Contract's conditions: a Brief never widens what a Builder may do.
- **Creator Mode is the first case:** the lesson is "how to ask for a plugin": the plugin API, the template, the lesson and the teaching surface a plugin needs. The person ends with a Brief that a Builder can build from, and has learnt why.
- The same channel can later run the other way: a Builder that needs a decision explains it, and the Tutor turns it into a lesson for the person; the person answers the Builder.

### 2. The Contract is the Plan Mode of aidea, for a whole project

In an agent such as Claude Code, Plan Mode means the agent may read and think but not edit; it writes a plan, the person approves it, and only then does it act. The Contract is the same idea at the scale of a project (the person's words, 2026-11-05): the plan that the Builders work from, agreed layer by layer (Business, Requirements, Architecture) and approved by the person. A Builder works inside it, and a departure goes through a Proposal the person accepts, as today.

How it differs from the Plan Mode of one task: the Contract lasts, is shared by every Builder, and afterwards checks the code against itself (the Differences). Two levels follow:

- **The Contract (project):** the approved plan of the whole project. Each requirement becomes one or more **tasks** with a status and an owner (a Builder instance, and a branch when they work in parallel). The Differences become the progress of the plan and the drift from it.
- **The plan of one task:** when a Builder takes a task or a Brief it first works in its own plan mode (read, think, propose a plan) and only after the person approves does it edit.

Decided by the person (2026-11-05): with the Contract plugin off there is no Contract and Builders are free; with it on the condition is hard: what is not in the Contract is not developed (to be tuned after use). How a plugin conditions others is in `.scratch/plugin-policies/spec.md`.

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

- (Answered 2026-11-05: the Tutor never sends a Brief; the person does.)
- Whether a Builder may ask the Tutor for help (proposal: later, same channel).
- The final name of the Contract-as-plan if "Contract" is thought to clash with the Contract of a software (proposal: keep Contract).
