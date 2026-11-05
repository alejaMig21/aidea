# 04: When no plugin reads a Project's language, aidea says so and offers a way forward

**What to build:** When the files of a Project are in a language that no enabled plugin claims, Components, Flow, Data and Playback say in plain words that no plugin reads that language, name the languages found, and offer "Ask the Builder for a plugin for R" (Creator Mode). The layers the person writes (Business, Requirements, Architecture) keep working. A Project with no analysable language at all is not an error.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A fixture Project in a language with no plugin opens; its authored layers work; the derived layers show the message and the offer.
- [ ] The offer opens the Builder with a prepared request for a plugin for that language; nothing is installed without the usual quarantine and confirmation.
- [ ] With Python turned off, a Python Project gets the same message.
- [ ] Page tests pass at 1920 and 1280 pixels wide.
