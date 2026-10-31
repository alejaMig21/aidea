# 10: A Panel can live on another monitor

**What to build:** The person moves a Panel (for example Canvas or Run) to a second window on another monitor. That window talks to the same core and stays in step with the main window: same Project, same selected file and Node, same Playback position. Closing the second window brings its Panels back to the main one. The Layout of both windows can be saved in a Preset.

**Blocked by:** 08 (dockable Layout).

**Status:** ready-for-agent

- [ ] A Panel moved to the second window shows live updates from the main one (selection, Playback steps, Tutor messages).
- [ ] Closing the second window returns its Panels to the main window without losing state.
- [ ] With one monitor, the option is not offered or says why it is unavailable.
- [ ] A Preset can record which Panels were on which window and restores them when possible.
- [ ] Verified live on two monitors; nothing in the isolated test setup touches the person's real preferences.
