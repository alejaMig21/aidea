// What aidea itself is (see guide.ts): GET /guide returns {guide}. The quick tour of "How aidea works" reads it.
import { GUIDE } from "../guide.ts";
import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  if (req.method !== "GET" || new URL(req.url ?? "/", "http://core").pathname !== "/guide") return false;
  core.send(res, 200, { guide: GUIDE, plugins: core.plugins.lessons().map((l) => ({ id: l.id, title: l.title, parts: l.parts })) });
  return true;
};

export default handler;
