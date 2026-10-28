import type { Core, Handler } from "../types.ts";
import type { Choice } from "../preferences.ts";

// The stored choice, with anything the adapter does not offer (any more) replaced by its first entry.
export function currentChoice(core: Core, project: string): Choice {
  const stored = core.preferences.get(project);
  const { modes, models } = core.adapter.options;
  const pick = (id: string | undefined, list: { id: string; available?: boolean }[]) =>
    list.find((o) => o.id === id && o.available !== false)?.id ?? list.find((o) => o.available !== false)?.id ?? ""; // "" = the adapter offers none
  return { mode: pick(stored.mode, modes), model: pick(stored.model, models), tutorModel: pick(stored.tutorModel, models) };
}

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (url.pathname !== "/agent-options") return false;
  const reject = (error: string) => {
    core.send(res, 400, { error });
    return true;
  };
  const { modes, models } = core.adapter.options;

  if (req.method === "GET") {
    const project = url.searchParams.get("project") ?? "";
    if (!core.projects.has(project)) return reject("project must be a Project that is already open");
    core.send(res, 200, { modes, models, choice: currentChoice(core, project) });
    return true;
  }

  if (req.method === "POST") {
    const body = (await core.readJson(req, res)) as Record<string, unknown> | null | undefined;
    if (body === undefined) return true; // readJson already answered
    const project = typeof body?.project === "string" ? body.project : "";
    if (!core.projects.has(project)) return reject("project must be a Project that is already open");
    const choice: Partial<Choice> = {};
    for (const field of ["mode", "model", "tutorModel"] as const) {
      const id = body?.[field];
      if (id === undefined) continue;
      const entry = field === "mode" ? modes.find((o) => o.id === id) : models.find((o) => o.id === id);
      if (!entry) return reject(`${field} is not offered by this agent`);
      const mode = modes.find((o) => o === entry);
      if (mode && !mode.available) return reject(`${mode.label} is not available: ${mode.reason ?? "no reason given"}`);
      choice[field] = entry.id;
    }
    if (!Object.keys(choice).length) return reject("send at least one of mode, model, tutorModel");
    core.preferences.set(project, choice);
    core.send(res, 200, { choice: currentChoice(core, project) });
    return true;
  }
  return false;
};

export default handler;
