# 04: Code is a Panel, no longer a layer

**What to build:** Choosing a file in the Files panel shows its whole source in a Code panel, with line numbers and highlighted syntax. The Code layer, its tab and its help entries are gone from the Layer bar. The Code panel is reachable even when the Canvas is hidden. A file that is too large or not text is refused with a plain message. It reuses the existing source route (whole file, range, size cap, plain refusals).

**Blocked by:** 03 (Files panel).

**Status:** ready-for-agent

- [ ] The layers list and the layer help no longer contain Code; a test fails if a Code layer reappears.
- [ ] Choosing a file in Files shows its source in the Code panel; the Code panel can be shown or hidden on its own.
- [ ] With the Canvas hidden, the Code panel still opens and works.
- [ ] A large file and a binary file give the plain refusal, not a hang.
- [ ] The change to a file on disk shows after a refresh.
- [ ] Everything the old Code layer did that the person used (highlighted lines from a Flow step, back, refresh) still works from the panel, or is explicitly moved to tickets 05 and 06.
- [ ] Verified live at 1920, 1280 and narrow; screenshots in the ticket.
