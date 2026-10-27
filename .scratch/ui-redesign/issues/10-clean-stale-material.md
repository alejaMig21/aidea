# 10: Clean up stale material

**What to build:** Remove what the dropped OpenCode direction left behind. ADR 0003 mentions that direction and is stale: it is either rewritten as an ADR about the interface technology (plain JavaScript and CSS, no framework) without that reference, or removed. The untracked OpenCode research note under `.scratch/aidea-v1/research/` is deleted. The person's own OpenCode clone outside the repository is left alone. The person paused this cleanup, so ask which option for ADR 0003 before touching it.

**Blocked by:** None (can start immediately)

**Status:** done

The person confirmed the cleanup is wanted (the interface is defined by the chosen mockups, not by OpenCode). Default: rewrite ADR 0003 as a short ADR keeping the real decision (plain JavaScript and CSS, no framework, revisit if smoothness fails), with no OpenCode reference.

- [x] ADR 0003 is rewritten with no OpenCode reference, and its title and filename no longer mention OpenCode.
- [ ] The OpenCode research note is deleted.
- [x] `GLOSSARY.md` and other docs do not point at either removed item.
