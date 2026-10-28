// Focus zoom: zooming into a Node frames the Footprint of its Trace links on the layer below.
import { loadAuthored } from "../authored.ts";
import { layoutComponentsDiagram } from "../components-layout.ts";
import { frameOf, layoutBusiness } from "../layout.ts";
import { layoutArchitecture } from "../architecture.ts";
import { AUTHORED_LAYERS, LAYERS, layerBelow, layoutOf, traceLinks } from "../traces.ts";
import type { AuthoredLayerKey, LayerKey } from "../traces.ts";
import type { Core, Handler, Project } from "../types.ts";
import type { ServerResponse } from "node:http";

// Where the person came from, one entry per zoom in. Reopening a Project starts a fresh trail.
type Origin = { layer: AuthoredLayerKey; node: string };
const trails = new WeakMap<Project, Origin[]>();

function openProject(core: Core, res: ServerResponse, id: unknown): Project | null {
  if (typeof id !== "string" || id === "") {
    core.send(res, 400, { error: "project is required" });
    return null;
  }
  const project = core.projects.get(id);
  if (!project) core.send(res, 404, { error: "Unknown project: open it with POST /projects first" });
  return project ?? null;
}

// A class is drawn as one box with its members inside: it stays lit with the members it holds, and the members with it.
function litBy(project: Project, footprint: string[], id: string): boolean {
  if (footprint.includes(id)) return true;
  const classOf = (n?: { parent: string | null }) => project.nodes.find((c) => c.id === n?.parent && c.kind === "class")?.id;
  const owner = id.includes("#") ? id.split("#")[0] : classOf(project.nodes.find((n) => n.id === id));
  return (owner !== undefined && footprint.includes(owner)) || footprint.some((f) => classOf(project.nodes.find((n) => n.id === f)) === id);
}

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");

  if (req.method === "GET" && (url.pathname === "/layout" || url.pathname === "/traces")) {
    const project = openProject(core, res, url.searchParams.get("project"));
    if (!project) return true;
    const authored = loadAuthored(project.path);
    if (url.pathname === "/traces") {
      core.send(res, 200, { links: traceLinks(project, authored) });
      return true;
    }
    const layer = url.searchParams.get("layer") as LayerKey;
    if (!LAYERS.includes(layer)) {
      core.send(res, 400, { error: `layer must be one of: ${LAYERS.join(", ")}` });
      return true;
    }
    const blocks = layer === "business" ? { blocks: layoutBusiness(authored.layers.business.nodes).blocks } : {};
    if (layer === "components") {
      const { rects, compartments, routes } = layoutComponentsDiagram(project.nodes, project.relationships);
      core.send(res, 200, { layer, rects, compartments, routes, unresolved: project.unresolved });
      return true;
    }
    core.send(res, 200, layer === "architecture" ? { layer, ...layoutArchitecture(authored.layers.architecture.nodes) } : { layer, rects: layoutOf(layer, project, authored), ...blocks });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/focus") {
    const body = (await core.readJson(req, res)) as { project?: unknown; layer?: unknown; node?: unknown } | null | undefined;
    if (body === undefined) return true; // readJson already answered
    const project = openProject(core, res, body?.project);
    if (!project) return true;
    const layer = body?.layer as AuthoredLayerKey;
    if (!AUTHORED_LAYERS.includes(layer)) {
      core.send(res, 400, { error: `layer must be one of: ${AUTHORED_LAYERS.join(", ")}` });
      return true;
    }
    const authored = loadAuthored(project.path);
    if (!authored.layers[layer].nodes.some((n) => n.id === body?.node)) {
      core.send(res, 404, { error: "Node not found" });
      return true;
    }
    const links = traceLinks(project, authored).filter((l) => l.layer === layer && l.from === body?.node);
    // The Footprint: what realises this Node in the layer below. Broken links have nothing left to show.
    const footprint = [...new Set(links.filter((l) => !l.broken).map((l) => l.to))].sort();
    const broken = [...new Set(links.filter((l) => l.broken).map((l) => l.to))];
    if (footprint.length === 0) {
      core.send(res, 422, {
        error: broken.length ? `All Trace links of this Node are broken: ${broken.join(", ")}` : "Node has no Trace links to follow",
      });
      return true;
    }
    // A functional requirement whose links all lead to code zooms to Components, not to Architecture.
    const below = layerBelow[layer];
    const target = layoutOf(below, project, authored).some((r) => footprint.includes(r.id)) ? below : "components";
    const rects = layoutOf(target, project, authored);
    trails.set(project, [...(trails.get(project) ?? []), { layer, node: body!.node as string }]);
    core.send(res, 200, {
      layer: target,
      origin: { layer, node: body!.node },
      footprint,
      frame: frameOf(rects.filter((r) => footprint.includes(r.id))),
      dimmed: rects.filter((r) => !litBy(project, footprint, r.id)).map((r) => r.id),
      broken,
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/focus/out") {
    const body = (await core.readJson(req, res)) as { project?: unknown } | null | undefined;
    if (body === undefined) return true;
    const project = openProject(core, res, body?.project);
    if (!project) return true;
    const trail = trails.get(project);
    const origin = trail?.pop();
    if (!origin) {
      core.send(res, 409, { error: "Nothing to zoom out from" });
      return true;
    }
    const rect = layoutOf(origin.layer, project, loadAuthored(project.path)).find((r) => r.id === origin.node);
    if (!rect) {
      core.send(res, 409, { error: "The Node you came from no longer exists" });
      return true;
    }
    core.send(res, 200, { layer: origin.layer, node: origin.node, frame: frameOf([rect]), remaining: trail!.length });
    return true;
  }
  return false;
};

export default handler;
