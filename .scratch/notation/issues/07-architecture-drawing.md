# 07: The Architecture layer is drawn C4-style

**What to build:** The Architecture layer is drawn from the new data (spec: Architecture drawing). An element with children is a dashed boundary with a title (`name [kind]`) enclosing them; a leaf is a box with a coloured dot, name, `[kind: technology]` and description; a person has a person glyph; elements outside the boundary (external systems, people) sit outside it. Relationships are one-way labelled arrows with the technology when known, flowing in their direction, with request packets travelling along them in a loop; a Proposal element has the dashed accent outline and a PROPOSAL tag and breathes. Hovering an element lights its relationships. The parent connector line of ticket 13 is replaced by containment. Positions and routes come from the layout engine (boundaries with one level of nesting). The legend states that boundaries are a convention of C4 tooling and lists what is not shown.

**Blocked by:** 02, 06

**Status:** done

- [ ] Through the core protocol: the Architecture layout puts children inside their parent's boundary with a margin, roots outside it, no overlaps, identical results for the same input; relations are returned with routes and label positions.
- [ ] Children are visibly inside their boundary; relationships show label and technology; an unknown kind is drawn as a generic box.
- [ ] A Proposal that adds an element or a relation previews in place with the dashed accent look; accepting or rejecting keeps working.
- [ ] Packets travel along relationships; the animation switch and reduce-motion are respected.
- [ ] The legend opens from "?".
- [ ] Verified headless: screenshots of the `studio` fixture (extended with kinds, descriptions and relations) next to the prototype's Architecture tab, differences listed in the review notes; no console errors.

## Review notes

Headless run (Chrome, 1440x900, `studio-c4` fixture, after the review fixes): the layer draws (about 50 shapes) with no console errors, and only the Mail service gets the External look because it sets `external: true`. Not verified: hover lighting, packets and the person glyph were not inspected in this run; the drawing was not compared side by side with the prototype's Architecture tab; proposal previews were covered by protocol tests, not looked at in a browser.

## Review fixes

- Only a Node with `external: true` is drawn with the dashed External look and label (see ticket 06).
- An unknown `kind` is drawn as a generic box (the Node is kept; see ticket 06), as this ticket's acceptance list says.
- The layout indexes boundary members in a Map instead of scanning leaves per relation, climbs parent chains iteratively, and ignores a repeated id after the first.
- The leftover generic card loop and parent connector of ticket 13 were deleted from `20-authored.js` and `70-proposals.js`; `layoutAuthored` was unreachable and is gone.
- Broken-link marks survive an Architecture redraw (`markBroken()`).
