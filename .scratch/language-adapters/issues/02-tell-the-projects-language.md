# 02: The person is told which languages a project has and which are analysed

**What to build:** Today a project in a language aidea does not analyse opens as an empty Components layer with no explanation. Detect the languages of a project from its files (ignoring the usual dependency and build folders), say it in plain words when the project is opened (for example "Analysed: Python, 587 files. Not analysed yet: JavaScript, 12 files"), and when nothing at all is analysable say so instead of showing an empty canvas. The information is small, near the project name, and uses the shared scale of sizes and colours.

**Blocked by:** language-adapters 01.

**Status:** done

- [x] Through the protocol: opening a project returns its languages with file counts and which have an adapter; ignored folders are not counted.
- [x] The interface shows one short line with that information, and a project with no analysable language shows an explanation on the Components layer.
- [x] A mixed project (Python plus JavaScript) is described correctly and still analyses the Python part.
- [x] Verified in the real app on the main screen at two window sizes, with `docs/agents/ui-style.md` respected.
