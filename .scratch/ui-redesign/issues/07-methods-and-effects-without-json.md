# 07: Methods and effects data without JSON

**What to build:** The same form covers methods and effects. For a method, the analysis also reports the constructor's parameters, shown as extra fields so the instance can be built without JSON. For an Algorithm that reads files or calls the network, the data for those effects is a set of labelled rows, each prefilled with a sample and written as literals, instead of a hand-written object.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Through the core protocol: analysis of a method reports the constructor parameters with defaults, annotations and suggestions.
- [ ] Playback of a method builds the instance from the constructor values.
- [ ] Effects data arrives as named rows of literals and is applied; a non-literal row is refused and not run.
- [ ] Earlier Playback guarantees still hold.
- [ ] Checked live: constructor fields and effect rows appear prefilled and run.
