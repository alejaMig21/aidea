# The interface is plain JavaScript and CSS in the first version, and must still feel as smooth as OpenCode

aidea's interface imitates OpenCode's layout and behaviour (not its name, logo or assets), but not its technology: OpenCode uses SolidJS, Kobalte and Tailwind, while aidea writes plain JavaScript and CSS with no new dependencies and no build step. This is a decision for the first version only. The goal that does not change is the feel: fast, smooth, comfortable and attractive, because those qualities matter in any software. If plain code cannot reach that smoothness (resizable and foldable columns, long message lists, animations), adopting a framework is the expected next step, not a failure.

## Considered Options

- **Adopt SolidJS, Kobalte and Tailwind like OpenCode.** Closer to the reference and ready-made components, but adds a build step and dependencies to a project that has none beyond TypeScript and Electron.

## Consequences

- aidea writes its own components (resizable and foldable columns, message list, permission cards) and must test their smoothness on real use, not only that they work.
- Light and dark themes follow the system setting.
- Revisit this decision once the first version is in a person's hands, with smoothness as the criterion.
