// Algorithms layer: the control-flow graph of one function, laid out and framed by the core.
import { frameOf, layoutFlow } from "../layout.ts";
import type { FlowEdge } from "../layout.ts";
import { locate } from "../locate.ts";
import { runPython } from "../python.ts";
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

  // The script wants the name inside its file: the Node id without the module's own id in front.
  let module = node;
  while (module.parent) module = project.nodes.find((n) => n.id === module.parent) ?? { ...module, parent: null };
  const qualifiedName = node.id.slice(module.id.length + 1);

  let flow: { steps: { id: string }[]; edges: FlowEdge[] };
  try {
    flow = JSON.parse(await runPython("flow.py", [file, qualifiedName], 30_000));
  } catch (e) {
    if ((e as { code?: number }).code === 2) {
      core.send(res, 422, { error: "The function is no longer in its file: refresh the Project" });
      return true;
    }
    throw e;
  }

  const rects = layoutFlow(flow.steps, flow.edges);
  core.send(res, 200, { node: node.id, file: node.file, line: node.line, endLine: node.endLine, ...flow, rects, frame: frameOf(rects) });
  return true;
};

export default handler;
