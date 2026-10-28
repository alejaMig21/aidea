// Trace links: a Node on an authored layer lists, in its `traces` field, the ids of Nodes in the layer below
// that realise it. Business -> Requirements -> Architecture -> Components. A link whose target is gone is broken.
import { layoutAuthored, layoutBusiness, layoutComponents } from "./layout.ts";
import type { Rect } from "./layout.ts";
import type { loadAuthored } from "./authored.ts";
import type { Project } from "./types.ts";

export const AUTHORED_LAYERS = ["business", "requirements", "architecture"] as const;
export type AuthoredLayerKey = (typeof AUTHORED_LAYERS)[number];
export const LAYERS = [...AUTHORED_LAYERS, "components"] as const;
export type LayerKey = (typeof LAYERS)[number];

export const layerBelow: Record<AuthoredLayerKey, LayerKey> = {
  business: "requirements",
  requirements: "architecture",
  architecture: "components",
};

type Authored = ReturnType<typeof loadAuthored>;
export type TraceLink = { layer: AuthoredLayerKey; from: string; to: string; broken: boolean };

export function layoutOf(layer: LayerKey, project: Project, authored: Authored): Rect[] {
  return layer === "components" ? layoutComponents(project.nodes)
    : layer === "business" ? layoutBusiness(authored.layers.business.nodes).rects
    : layoutAuthored(authored.layers[layer].nodes);
}

export function traceLinks(project: Project, authored: Authored): TraceLink[] {
  const links: TraceLink[] = [];
  for (const layer of AUTHORED_LAYERS) {
    const targets = new Set(layoutOf(layerBelow[layer], project, authored).map((r) => r.id));
    for (const node of authored.layers[layer].nodes) {
      for (const to of (node.traces as string[] | undefined) ?? []) {
        links.push({ layer, from: node.id, to, broken: !targets.has(to) });
      }
    }
  }
  return links;
}
