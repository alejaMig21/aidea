# 09: The blind exam lives in the repository and runs with the Tutor

**What to build:** Move the exam that was done by hand into the repository: a script that makes the blind copy of a Project (documents and history removed, leaks listed), runs the Tutor on it with its tools, and a scoring file per Project (what the documents say, to compare). Run it on three or more documented projects, one of them not in Python, and repeat runs to see how much the result varies. It is how aidea knows its inference is good before a release.

**Blocked by:** layer-inference 05.

**Status:** ready-for-agent

- [ ] The script produces the blind copy and reports any documentation-like file it found left (such as `openspec/config.yaml`).
- [ ] A scoring file exists for Telegram and hubstaff-automation from the first exam.
- [ ] A run reports found, missed and invented items per layer.
- [ ] Two runs of the same Project are compared and the spread is written down.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.
