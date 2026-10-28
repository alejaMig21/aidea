# 03: The Tutor reads the project, only inside its folder

**What to build:** The Tutor roles get read-only tools through the core's Canvas tool server: read the authored layers and a Node with its Rationale, read a code snippet or a file inside the open Project's folder, list the Project's files, and read a Playback recording. They have no shell, no write tool and no way to read outside the Project folder, including through links, relative paths or alternative spellings. The tools return small, structured results.

**Blocked by:** 02

**Status:** done

- [x] Through the protocol: each read tool returns the expected content on a fixture project.
- [x] A path outside the Project (parent traversal, absolute path elsewhere, a link pointing out, a different casing or a drive-relative form on Windows) is refused with a clear message and nothing is read.
- [x] No tool of the Tutor roles can write, delete, move or execute; the tool list is asserted.
- [x] Large files are cut with a note of what was left out.
- [x] The Tutor tools are not available to the builder's session.

## Review notes

- [x] Tests (`test/tutor-reads.test.ts`, 14 tests, through the Tutor MCP endpoint of a class): exact tool list (`ask`, `read_layers`, `read_node`, `list_files`, `read_file`, `read_recording`) with no write-like name; the builder's tool list lacks the read tools and its call to `read_file` returns no content; each read tool on a fixture Project; pending Proposals marked `pending` and kept out of the accepted layers; large file cut at 20,000 characters with a note; binary refused; list capped at 500 with a note; a snapshot shows the Project is unchanged after every tool ran.
- [x] Written first and seen failing (tool list lacked the new tools; every read call errored), then implemented. Full `npm test` (287 pass, 1 skipped, pre-existing) and `npm run typecheck` pass.
- [x] Refused with a plain message and nothing read: `..` traversal (also through `sub/..`), absolute paths elsewhere (both slashes, `\\?\`), drive-relative (`C:secret.txt`, `C:..\x`), UNC (`\\host\share`, `//host/share`), a folder junction pointing outside (also with different letter case and backslashes), `.git` (any case) and `.aidea`, a folder, a NUL in the path, a non-text path.
- NOT tested: a file symbolic link pointing outside (needs a privilege on this Windows machine; the test skips that single case with a diagnostic). The code path is the same `realpath` check as for the junction.
- Design: tools live in `src/core/tutor-reads.ts`; `mcp.ts` lists `[...TUTOR_TOOLS, ...READ_TOOLS]` for the Tutor role only. A recording now carries the `project` id it was made for, so `read_recording` never returns another Project's recording. `list_files` does not follow links; `.aidea` is hidden from `list_files`/`read_file` (the layers come through `read_layers`).
