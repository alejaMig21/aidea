# 12: Spike: what values can Playback capture, and in which languages

**Type:** prototype (throwaway)

**What to build:** A short investigation that answers, with evidence: which languages can record the values of a running function with their shape today (Python, TypeScript/JavaScript) given each adapter; how the identity of an object can be obtained in each, so that two names for one object are recognised; the cost of recording large values; and what the Playback guards allow. The verdict says what the structured-value contract (ticket 13) can promise and where the Data layer must say plainly that a language is not supported.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A short written verdict in the log: per language, what can be captured, how identity works, what limits are needed.
- [ ] A measured cost for a list of 10,000 numbers and for a linked structure of 1,000 objects.
- [ ] A list of anything that cannot be captured (opaque values) and what Data should show for it.
- [ ] The spike code is discarded or kept on a `prototype/` branch; only the verdict is folded into tickets 13 to 15.
