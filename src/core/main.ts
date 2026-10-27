import { startCore } from "./server.ts";

const core = await startCore({ port: Number(process.env.AIDEA_PORT ?? 0) });
console.log(`aidea core listening on ${core.url}`);
