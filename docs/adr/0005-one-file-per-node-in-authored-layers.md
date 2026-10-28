# Authored layers are stored as one file per Node

The Business, Requirements and Architecture layers are stored in the project's `.aidea/` folder as one file per Node, grouped in a folder per layer, instead of one file per layer holding every Node. The reason is teamwork: two people who add or change different Nodes of the same layer on one branch should not collide in git. The existing single file per layer keeps being read, so projects written before this change still open; it is converted when its layer is next written. Each Node file stays plain JSON a person can edit by hand.

Real-time cursors (seeing what each teammate does on a layer) are not part of this decision: they need a relay server and wait until the graphs can be edited by hand.

## Considered Options

- **Keep one file per layer, one Node per line in a fixed order.** Cheaper, but two people who add Nodes at the same place still conflict.
- **One file per Node.** A larger change to how layers are read and written, and more small files in `.aidea/`, but a conflict can only happen when the same Node is edited twice.

## Consequences

- Reading and writing authored layers, Proposals that accept a change and their tests change; the Node shape does not.
- Architecture Pattern groups, which live at the top level of the layer today, need their own place in the same scheme.
- What each person has learned (Plan, Learner graph, Evidence) stays private to the person and outside the project. Only the Contract travels with the repo.
