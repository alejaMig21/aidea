// The teaching content of the five diagram layers (see layer-help.ts): GET /layers/help returns {layers}. The quick tour reads it.
import { LAYER_HELP } from "../layer-help.ts";
import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  if (req.method !== "GET" || new URL(req.url ?? "/", "http://core").pathname !== "/layers/help") return false;
  core.send(res, 200, { layers: LAYER_HELP });
  return true;
};

export default handler;
