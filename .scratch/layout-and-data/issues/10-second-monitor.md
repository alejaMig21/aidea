# 10: A Panel can live on another monitor

**What to build:** The person moves a Panel (for example Canvas or Run) to a second window on another monitor. That window talks to the same core and stays in step with the main window: same Project, same selected file and Node, same Playback position. Closing the second window brings its Panels back to the main one. The Layout of both windows can be saved in a Preset.

**Blocked by:** 08 (dockable Layout).

**Status:** on hold (audit 2026-11-04): needs a second screen and the person works on one. A Panel that comes from a plugin should be movable to the other window the same way

**In the first docking release (decided 2026-10-31, ADR 0007).** The person wants the second window in the first version, which is why the Layout is built on `dockview-core`: its popout moves a Panel's DOM into a window opened by the same page, so the second window keeps one JavaScript context and stays in step with the main one by construction. The first thing this ticket measures is the part the spike could not: how Electron's window-open rules treat that popout (placement on the other monitor, closing it, a window that was dragged to a monitor that is later unplugged).

- [ ] A Panel moved to the second window shows live updates from the main one (selection, Playback steps, Tutor messages).
- [ ] Closing the second window returns its Panels to the main window without losing state.
- [ ] With one monitor, the option is not offered or says why it is unavailable.
- [ ] A Preset can record which Panels were on which window and restores them when possible.
- [ ] Verified live on two monitors; nothing in the isolated test setup touches the person's real preferences.
