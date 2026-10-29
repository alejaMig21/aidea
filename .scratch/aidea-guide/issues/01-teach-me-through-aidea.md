# 01: "Teach me through aidea": the Tutor teaches the person to use the app

**What to build:** aidea has a builder, a Tutor, a Canvas with layers, Proposals, Class and Direct mode, a Plan, the Contract, Differences, Playback and a legend on every layer, and nothing teaches a newcomer how they fit together. Add a button in the top bar, "How aidea works", that starts a Tutor class about the app itself, in the same way "Teach me through it" does for a layer: the content lives in one structure in the core (what each part is, when to use it, one example, the order to tell them in), the class uses the teach loop and asks the person to do small things in the real interface ("open the Requirements layer", "ask the builder for a change and look at the Proposal"), and without the Tutor the fixed quick tour of the same content runs and says so.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The app's teaching content is one structure served by the core, in plain words, with no jargon (checked by the same test as the layer content).
- [ ] Through the protocol: the class starts with the app content as data, follows the teach loop, and the first step is about what the person sees first, not a lecture.
- [ ] Without the Tutor the quick tour of the same content runs, says the Tutor is not available, and can be closed with Escape.
- [ ] The button sits in the top bar without disturbing the layout, follows `docs/agents/ui-style.md`, and works at 1920 and 1280 pixels wide.
- [ ] Verified live with the real Claude Code on the main screen: the class teaches something correct about the app and does not invent features (compare with the content).
