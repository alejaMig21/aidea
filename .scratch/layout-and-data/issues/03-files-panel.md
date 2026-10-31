# 03: Files panel shows the folder hierarchy of the Project

**What to build:** A Files panel, hidden until asked for, shows the folders and files of the open Project as a tree that expands and collapses. Folders that are not the person's work (version-control data, dependency folders, caches, build output) are skipped. Files in a language aidea can analyse are marked apart from the rest. It works on any folder, even when no language is understood, and never writes to the Project. A new read-only core route supplies the tree.

**Blocked by:** 02 (Run panel and the Panel vocabulary).

**Status:** ready-for-agent

- [ ] The tree route returns nested folders and files for a fixture Project, skips the ignored folders, flags analysable files and handles a non-text file and an unsupported language.
- [ ] The route writes nothing (checked by comparing the fixture before and after).
- [ ] The Files panel can be shown and hidden, folders open and close, and a folder with thousands of entries stays smooth.
- [ ] Works on a folder with no understood language.
- [ ] Verified live, read-only, on the two real Projects named in the handoff (`git status` before and after is identical).
