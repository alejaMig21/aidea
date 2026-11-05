# Plugins that condition other plugins (policies)

Status: draft, waiting for the person's read

Source: the person's remarks of 2026-11-05 (plugins are conditional and conditioning; the Contract restricts writers when it is on; no dependence on a type of Builder; classify plugins); plugin-system ticket 11 (guard rules from plugins, built); ADR 0008; `.scratch/roles-and-contract/spec.md`.

## Problem

The Contract should restrict what Builders do, hard: what is not in the Contract is not developed. But a Builder is a plugin, a person can write their own with Creator Mode, and the Contract must not demand a certain kind of Builder, nor be skippable by one. A Builder that writes essays outside any Project should not be held by a Contract about code. And with the Contract plugin off, nothing is restricted and no Contract exists.

## Idea

A plugin has two relations to the others:

- **Conditional:** it works only when what it needs is there (dependencies, today's ticket plugin-system 09).
- **Conditioning:** while it is on, it sets conditions on what other plugins may do. This is a **policy**.

A policy is the guard rule of plugin-system 11 given a precise target: it speaks about **actions**, not about types of plugin.

## Decisions (agreed with the person unless marked)

1. **Off means absent.** With the Contract plugin off there is no Contract and no condition; Builders are free. With it on, the condition is hard: **what is not in the Contract is not developed.** A small change outside it goes through a Proposal that adds it to the Contract. (To be tuned after real use, the person said.)
2. **The Contract names no Builder.** It conditions actions, whoever does them, so any Builder (the Claude Code one, one the person made with Creator Mode, another provider) is held by the same rule.
3. **Classify by what a plugin does, not by what it is called.** Plugins already declare capabilities (files, network, processes). A policy matches an action by its **class and scope**: for the Contract, "writes inside this Project's folder". A Builder that writes essays outside any Project does not match, so it is not held. A "writing plugin" in general is too wide a class and is not used.
4. **The classes and scopes need to be listed** (agent's proposal to refine): writes to the Project (code, authored layers), writes outside the Project, runs a program, uses the network, reads secrets. Each declared by the plugin, checked by the scan, and observed by the kernel where it can.

## How "hard" is enforced, honestly

A policy can only prevent what the kernel sees:

- **Where aidea mediates the action,** it can refuse before it happens. For a Builder driven through Claude Code this is true today: every write asks aidea's permission tool (`--permission-prompt-tool`), so a guard rule can say no.
- **Where aidea does not mediate** (a plugin that writes straight to disk with its own code, or an agent whose protocol has no permission step), aidea cannot prevent. It **detects** the change (the file watcher already guards `.aidea/`; the same for Project files) and **reverts or flags** it as a Difference. A plugin that declared it writes to the Project is stopped at the door by the scan when its declarations do not match what its code does.
- The screen says which it is: "prevented" or "detected and reverted", never a guarantee it cannot give.

## What exists, and what is missing

Exists: guard rules from plugins (any "no" wins, a rule may ask the person), the permission tool for the Builder, the file watcher for `.aidea/`, declared capabilities and the scan.
Missing: actions carrying their class and scope to the rule; the classes themselves; the watcher for Project files; the Contract plugin that offers the rule (roles-and-contract).

## Suggested slices

1. The classes and scopes of an action, declared by plugins and seen by guard rules.
2. A guard rule can match by class and scope; a fixture policy denies writes inside the Project.
3. Detect and revert (or flag) a write to the Project that no one mediated.
4. The Contract plugin offers its rule (after the Contract becomes a plugin).
5. The screen that says, per plugin and rule, prevented or detected.

## Open

- The exact list of classes and scopes.
- Whether the person can lift the condition for one task by hand (proposal: yes, a visible, logged exception).
- How a policy shows to the person, so that "why was my Builder stopped" is answered in plain words.
