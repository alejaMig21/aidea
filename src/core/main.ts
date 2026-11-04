import { homedir } from "node:os";
import { join } from "node:path";
import { parseRoleAdapters, startCore } from "./server.ts";

// The recent Projects live in the person's home folder, outside any Project.
const recentsFile = process.env.AIDEA_RECENTS_FILE ?? join(homedir(), ".aidea", "recents.json");
const preferencesFile = process.env.AIDEA_PREFERENCES_FILE ?? join(homedir(), ".aidea", "preferences.json");
const learnerDir = process.env.AIDEA_LEARNER_DIR ?? join(homedir(), ".aidea", "learner");
const pluginsDir = process.env.AIDEA_PLUGINS_DIR ?? join(homedir(), ".aidea", "plugins"); // the plugin store (docs/plugin-api.md); the plugins that ship with aidea are in src/plugins
// AIDEA_ROLE_ADAPTERS="tutor=default,grader=default": which agent serves which role (only "default", Claude Code, exists today).
const roleAdapters = parseRoleAdapters(process.env.AIDEA_ROLE_ADAPTERS);
const core = await startCore({ port: Number(process.env.AIDEA_PORT ?? 0), roleAdapters, recentsFile, preferencesFile, learnerDir, pluginsDir, safeMode: process.env.AIDEA_SAFE_MODE === "1" });
console.log(`aidea core listening on ${core.url}`);
