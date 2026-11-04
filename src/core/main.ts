import { homedir } from "node:os";
import { join } from "node:path";
import { parseRoleAdapters, startCore } from "./server.ts";
import { createFileSecretStore } from "./plugins/settings.ts";

// The recent Projects live in the person's home folder, outside any Project.
const recentsFile = process.env.AIDEA_RECENTS_FILE ?? join(homedir(), ".aidea", "recents.json");
const preferencesFile = process.env.AIDEA_PREFERENCES_FILE ?? join(homedir(), ".aidea", "preferences.json");
const learnerDir = process.env.AIDEA_LEARNER_DIR ?? join(homedir(), ".aidea", "learner");
const pluginsDir = process.env.AIDEA_PLUGINS_DIR ?? join(homedir(), ".aidea", "plugins"); // the plugin store (docs/plugin-api.md); the plugins that ship with aidea are in src/plugins
// AIDEA_ROLE_ADAPTERS="tutor=default,grader=default": which agent serves which role (only "default", Claude Code, exists today).
const roleAdapters = parseRoleAdapters(process.env.AIDEA_ROLE_ADAPTERS);
// The desktop app hands the core a key it keeps sealed with the operating system; with it the secrets of plugins survive a restart. Without it (the core run alone) they last until it stops.
const secretFile = process.env.AIDEA_SECRETS_FILE ?? join(homedir(), ".aidea", "secrets.enc");
const secretStore = process.env.AIDEA_SECRET_KEY ? createFileSecretStore(secretFile, process.env.AIDEA_SECRET_KEY) : undefined;
delete process.env.AIDEA_SECRET_KEY; // nothing the core starts (a plugin's program, the agent) inherits the key
const core = await startCore({ port: Number(process.env.AIDEA_PORT ?? 0), roleAdapters, recentsFile, preferencesFile, learnerDir, pluginsDir, safeMode: process.env.AIDEA_SAFE_MODE === "1", secretStore });
console.log(`aidea core listening on ${core.url}`);
