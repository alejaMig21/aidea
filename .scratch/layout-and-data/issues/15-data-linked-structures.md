# 15: Data draws linked objects, trees and aliases

**What to build:** Objects that point to other objects (linked lists, trees, graphs) are drawn as nodes and arrows. Data with the shape of a tree is drawn as a tree. The same object reachable from two variables is drawn once, with both names pointing to it, so aliasing is visible. Cycles are drawn without looping forever.

**Blocked by:** 14 (Data layer v1).

**Status:** ready-for-agent

- [ ] A linked list, a binary tree, a graph with a cycle and an aliased object each draw as expected on fixture functions (verified live; shapes and counts checked through the protocol).
- [ ] The cut limit applies to nodes and depth and is stated.
- [ ] A step that rewires a pointer highlights the old and new arrow.
- [ ] Verified live at 1920, 1280 and narrow with screenshots; compared with the same structures in visualgo.net.
