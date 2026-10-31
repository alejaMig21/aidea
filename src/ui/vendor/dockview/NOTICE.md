# dockview-core (vendored)

The docking Layout (ADR 0007) is built on `dockview-core`, a docking library for the browser with no dependencies.

- Version: 8.8.3
- File: `dockview-core.min.js` is `dist/dockview-core.min.js` of the npm package, unchanged. It carries its own CSS and defines `window["dockview-core"]`.
- Licence: MIT, Copyright (c) 2021 mathuo. The licence text is in `LICENCE.md` next to this file and must stay with the script.
- Source: https://github.com/mathuo/dockview (package `dockview-core` on npm). `dockview-enterprise` is not used.
- It is served by the core at `/vendor/dockview/<file>` and loaded by a `<script src>` in `src/ui/index.html`. It is never loaded from a network, and it is not in `package.json`.

To update: in an empty scratch folder run `npm pack dockview-core@<version>`, unpack it, copy `dist/dockview-core.min.js` and `LICENCE.md` here, change the version above, and run `npm test` (the docking page test runs the real library) and the measurements of ticket 08.
