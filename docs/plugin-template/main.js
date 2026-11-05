// The host half of the plugin: it gives the Tutor a snapshot of the plugin's state, which the view and the checks in teach.mjs read (docs/plugin-api.md, "The teaching surface").
export function activate(ctx) {
  ctx.teach.state(() => ({ open: true })); // plain data: what the person has done in the plugin
}
