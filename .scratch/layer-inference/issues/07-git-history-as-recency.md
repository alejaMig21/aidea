# 07: Git history tells live code from legacy

**What to build:** The fingerprint and a Tutor read tool `read_history` give bounded facts from git: most changed files, last change per folder, what was removed or retired recently, branches. The Tutor uses them to put attention on live code and to mark leftovers as legacy, as the exam showed it must (hubstaff-automation misled the blind run because retired Hubstaff-era data was still in the tree).

**Blocked by:** layer-inference 02.

**Status:** ready-for-agent

- [ ] The tool answers from a fixture repository with known history, bounded and inside the Project.
- [ ] A folder untouched for a stated time is flagged as possible legacy in the fingerprint, never deleted or hidden.
- [ ] A Project that is not a git repository answers in plain words that there is no history.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.
