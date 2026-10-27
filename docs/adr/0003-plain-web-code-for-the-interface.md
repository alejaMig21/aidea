# The interface is plain JavaScript and CSS in the first version

aidea's interface is written in plain JavaScript and CSS, with no framework, no new dependencies and no build step beyond what the project already has (TypeScript and Electron). Fonts are bundled with the app, so the interface needs no network to look right. This is a decision for the first version only. The goal that does not change is the feel: fast, smooth, comfortable and attractive. If plain code cannot reach that smoothness (resizable and foldable columns, long message lists), adopting a framework is the expected next step, not a failure.

## Considered Options

- **Adopt a UI framework and a styling toolkit.** Ready-made components, but adds a build step and dependencies to a project that has none.

## Consequences

- aidea writes its own components (resizable and foldable columns, message list, permission cards) and must test their smoothness on real use, not only that they work.
- The interface has a dark theme only in the first version.
- Revisit this decision once the first version is in a person's hands, with smoothness as the criterion.
