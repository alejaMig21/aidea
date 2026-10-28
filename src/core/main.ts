import { homedir } from "node:os";
import { join } from "node:path";
import { startCore } from "./server.ts";

// The recent Projects live in the person's home folder, outside any Project.
const recentsFile = process.env.AIDEA_RECENTS_FILE ?? join(homedir(), ".aidea", "recents.json");
const preferencesFile = process.env.AIDEA_PREFERENCES_FILE ?? join(homedir(), ".aidea", "preferences.json");
const learnerDir = process.env.AIDEA_LEARNER_DIR ?? join(homedir(), ".aidea", "learner");
const core = await startCore({ port: Number(process.env.AIDEA_PORT ?? 0), recentsFile, preferencesFile, learnerDir });
console.log(`aidea core listening on ${core.url}`);
