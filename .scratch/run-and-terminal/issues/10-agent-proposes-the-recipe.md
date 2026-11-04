# 10: An agent proposes the run recipe

**What to build:** For a Project with no recipe, the person can ask for one. An agent reads the Project once and proposes the recipe as a Proposal: the parts, their commands and folders, the order, and for each part a ready signal found in the code (a port, a line it prints, a file, a URL). When it finds nothing observable for a part it asks the person what is seen when that part works and builds the signal from the answer; if the answer is "nothing", it proposes that the Builder add a log line, as a separate Proposal the person can reject. A part is never given a signal that was not checked. The person accepts or corrects the Proposal, and from then on Play uses the recipe with no agent. The person can ask the agent to review the recipe when the project changes. See `.scratch/run-and-terminal/spec.md` (stories 2 to 5 and 15 to 18).

**Blocked by:** 06.

**Status:** built and tested; live check with a real Builder pending

- [x] Asking for a recipe produces a Proposal drawn like any other, with every part's ready signal named and the files it rests on.
- [x] A Project with a part that has nothing observable leads to the question to the person, and to a log-line Proposal only when the answer is "nothing".
- [x] Rejecting the Proposal leaves no recipe; accepting it writes the recipe and Play then asks for the usual acceptance of ticket 04.
- [x] Asking for a review shows what the agent would change as a Proposal and never overwrites the recipe by itself.
- [x] Tests at the core API with a fake agent and page tests for the Proposal pass (test/run-recipe-proposal.test.ts, test/run-recipe-page.test.ts).
- [ ] A live check on a real Project with a real Builder, on the second monitor.

## Decisions (2026-11-04, taken for the person, who delegated them)

- A review of an existing recipe is asked with the button "Ask the Builder to review the recipe", offered in the top bar after a part failed; otherwise in the chat. The review never overwrites: the card shows the old recipe's difference and waits for Accept.
- The log line for a program with nothing observable is a normal edit through the permission card, which the person can refuse; there is no second Proposal object.
- A ready signal is "shown" only when a cited file holds it whole (port as a whole number; an address by its port, or its path when it has none).
