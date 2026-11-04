# 15: Data draws linked objects, trees and aliases

**What to build:** Objects that point to other objects (linked lists, trees, graphs) are drawn as nodes and arrows. Data with the shape of a tree is drawn as a tree. The same object reachable from two variables is drawn once, with both names pointing to it, so aliasing is visible. Cycles are drawn without looping forever.

**Blocked by:** 14 (Data layer v1).

**Status:** built (`src/ui/features/58-data.js`, `test/data-layer-page.test.ts`); not compared with visualgo.net

- [x] A linked list, a binary tree, a graph with a cycle and an aliased object each draw as expected on fixture functions (page test counts nodes, arrows, arrows into one object, tree geometry; screenshots at 1920, 1280, 900).
- [x] The cut limit applies to nodes and depth and is stated ("cut: depth limit (6 levels)" is tested; the node limit text is not reached by any fixture).
- [x] A step that rewires a pointer highlights the old and new arrow (NEW heavy arrow, WAS dashed).
- [~] Verified with screenshots at 1920, 1280 and 900 wide; not compared with visualgo.net.

## Built

Object variables are always nodes; a list or dictionary is a node only when part of a pointer. A list or dictionary inside another list or dictionary stays a count ("list[3]"), as does anything inside a tuple. Roots that nothing points to come first so a list reads left to right. Fit repeats when the drawing outgrows the framed size. Edge change is compared with the step before in the recording (`pbIndex - 1`).
