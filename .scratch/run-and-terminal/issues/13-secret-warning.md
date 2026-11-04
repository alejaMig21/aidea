# 13: Warn before sending selected text that looks like a secret

**What to build:** Before any button of the selection control sends text to the Tutor or the Builder, aidea checks the text for what looks like a secret (a long key-like string, `password=`, `token=`, a private key header and similar). If it finds one, the control says "this looks like a secret" and asks for confirmation before sending. The text is never altered or hidden. The check is a warning, not a guarantee, and the person is told so. See `.scratch/run-and-terminal/spec.md` (story 51).

**Blocked by:** 11.

**Status:** built and tested; live check pending

- [x] Text with a recognised secret pattern asks for confirmation; cancelling sends nothing.
- [x] Confirming sends the text exactly as selected.
- [x] Ordinary error text (a traceback, a stack trace) does not trigger the warning in a set of real examples.
- [x] The check applies to every Panel's selection, not only the terminal.
- [x] Page tests cover the warning, the cancel and the confirm (test/secret-warning-page.test.ts).
- [ ] Verified live on the second monitor.
