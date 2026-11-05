// The Python language plugin: fills the language slot with the adapter in src/core/python-adapter.ts. The analysis scripts stay next to it in src/core.
import { pythonAdapter } from "../../core/python-adapter.ts";

export function activate(ctx) {
  ctx.languages.provide(pythonAdapter);
}
