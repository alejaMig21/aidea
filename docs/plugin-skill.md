# How to write an aidea plugin (a skill for agents)

You write plugins for aidea, a desktop app where the person builds software on layers. A plugin is a folder of finished plain JavaScript and a manifest. The person installs it; you never install anything.

## The steps

1. **Start small.** Write the smallest plugin that does what the person asked, usually one Panel or one guard rule. No second feature, no options nobody asked for. Stop when it works.
2. **Inspect the live app before you write.** Read `GET /plugins/inspect` (it changes nothing). It lists the API version, the slots you can add to and the shape of their entries, the capabilities, the event modes, the style tokens, and what active plugins already provide. Write against that, not against what you remember. The rules are in `docs/plugin-api.md`.
3. **Copy the template.** `docs/plugin-template/` is a working plugin with one Panel. Copy it into your workspace, change the `id` in `aidea-plugin.json` (3 to 64 characters of lowercase letters, digits, `-` and `.`), and edit `ui.js` (the part that runs in the window) and, if you need code in the core, add a `main.js` (the part that runs in the core) and name it in the manifest.
4. **Declare what you use.** If the code uses the network, files, processes, the page outside its own Panel, or secrets, list it in `capabilities`. The scan compares the list with the code: using something you did not declare blocks the install.
5. **Follow the rules of the format.** Plain JavaScript as ES modules, no build tool needed, libraries bundled into your folder beforehand, no install scripts, no compiled programs, no obfuscated code, no links that leave the folder. A plugin interface is plain DOM: use only the style tokens (CSS variables) for colours and fonts, and undo everything you added in the function you return.
6. **Check it.** Read the manifest again against the API document, and read your code once for anything that touches more than the person asked.
7. **Propose, never install.** Call the tool `propose_plugin` with the folder (inside the Project). aidea puts it in the quarantine, where nothing runs, scans it, and opens the plugin manager so the person can read the scan and decide. You have no tool that installs, enables or removes a plugin, and a plugin you wrote gets no shortcut. If the person asks for a change, change the files and propose again.

## What not to do

- Do not add features that were not asked for, and do not write variants "in case".
- Do not touch the person's other files to make the plugin work.
- Do not try to reach the plugin manager from the plugin itself: a plugin can never install another plugin.
- Do not put secrets in the manifest or the code.
- If the inspection shows an API version different from the one in your template, stop and say so.

## Test it before you propose it

`checkPlugin(folder)` in `src/core/plugins/testkit.ts` boots the real plugin host with your plugin alone, activates it, deactivates it, activates it again, and reports anything not back to its starting point (services, events, listeners, guard rules, timers, servers), plus the contract of each kind it finds: a Panel (the interface half must exist and export `activate`) and a guard rule (it must not throw on an ordinary action). Run it from a test: `const r = await checkPlugin("path/to/folder"); assert.deepEqual(r.problems, [])`. Fix every problem before you call `propose_plugin`.
