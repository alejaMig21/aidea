# 05: Measure aidea with a very high number of heavy plugins

**What to build:** The person wants to know how aidea behaves with many plugins, some heavy. Build a generator of fixture plugins (light, and heavy in time, memory, timers and Panels) and measure start-up time, memory, the Panels menu and moving the Canvas with 10, 50 and 200 plugins. Write the numbers and the budgets that become tests. Best done after the built-in features are plugins, so the measure is the real one.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A generator produces N fixture plugins of each weight.
- [ ] A table of start-up time, memory and responsiveness at 10, 50 and 200 plugins is written in this folder.
- [ ] A budget test fails if start-up or the Panels menu passes a stated limit.
- [ ] What to do when a plugin is too heavy (a warning in the manager) is decided with the person.

Source: The person's note of 2026-11-04.
