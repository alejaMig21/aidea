// Algorithms layer: the control-flow graph of one function, laid out and framed by the core.
import { AdapterError, adapterFor } from "../adapters.ts";
import { frameOf, layoutFlow } from "../layout.ts";
import { locate, moduleAndName } from "../locate.ts";
import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (req.method !== "GET" || url.pathname !== "/algorithm") return false;

  const found = locate(core, res, url.searchParams.get("project"), url.searchParams.get("node"));
  if (!found) return true;
  const { project, node, file } = found;
  if (node.kind !== "function") {
    core.send(res, 422, { error: "The Node is not a function: only functions have an Algorithm graph" });
    return true;
  }

  const { qualifiedName } = moduleAndName(project, node);

  const adapter = adapterFor(project.path);
  if (!adapter.flow) {
    core.send(res, 422, { error: "This project's language cannot draw an Algorithm graph yet" });
    return true;
  }
  let flow;
  try {
    flow = await adapter.flow(file, qualifiedName);
  } catch (e) {
    if (!(e instanceof AdapterError)) throw e;
    core.send(res, e.status, { error: e.message });
    return true;
  }

  const { rects, routes, lines } = layoutFlow(flow.steps, flow.edges);
  // The frame holds the steps and every point of every route (a way back runs outside the steps).
  const bounds = [...rects, ...routes.flatMap((r) => r.points.map((p) => ({ id: "", x: p.x, y: p.y, width: 0, height: 0 })))];
  core.send(res, 200, { node: node.id, file: node.file, line: node.line, endLine: node.endLine, ...flow, steps: flow.steps.map((s) => ({ ...s, lines: lines.get(s.id) })), rects, routes, frame: frameOf(bounds) });
  return true;
};

export default handler;
