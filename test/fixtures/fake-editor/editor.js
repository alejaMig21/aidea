// Stand-in for an editor: records the arguments it was started with.
import { writeFileSync } from "node:fs";
writeFileSync(process.env.FAKE_EDITOR_OUT, JSON.stringify(process.argv.slice(2)));
