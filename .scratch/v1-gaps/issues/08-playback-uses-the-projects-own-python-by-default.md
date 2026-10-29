# 08: Playback uses the Project's own Python environment by default

**What to build:** The v1 spec says Playback runs in the Project's own environment. Today it uses aidea's own Python unless the person says otherwise. Detect a virtual environment of the Project and use it by default, or record the deviation in an ADR if that is unsafe.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A project with a `.venv` or `venv` runs Playback with its interpreter; without one the behaviour is unchanged and the panel says which interpreter runs; an interpreter that does not work is reported in words.
