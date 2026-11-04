# Live scripts (real Electron window, main monitor)

Each script starts the real app with isolated data (`AIDEA_DISPLAY=secondary`, its own plugin store, its own secret files), drives it with `playwright-core` over the debugging port and prints PASS or FAIL.

- `lifecycle.mjs`: closing and restarting aidea while Play has parts running (the native question box is driven with Windows UI Automation: focus the button, press Space).
- `runterm.mjs`: environment variables by name, terminal selection (real mouse), the four buttons, the secret warning.
- `secrets.mjs`: a plugin's secret survives closing and reopening the window, and a forced kill.
- `look.mjs`: captures of the plugin manager and the Play dialog.

They need `playwright-core` (not a dependency of aidea): install it in a scratch folder next to the script and run `node <script>.mjs`. They use absolute paths of this machine (`D:/Projects/aidea`); change them for another one. Never run two at once: they kill `electron.exe`.
