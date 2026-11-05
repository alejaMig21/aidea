export function activate(ctx) {
  ctx.agents.tools.add({ name: "read_menu", description: "Reads the menu.", readOnly: true, inputSchema: { type: "object", properties: {} }, run: () => ({ dishes: ["soup", "bread"] }) });
  ctx.agents.tools.add({ name: "clear_menu", description: "Clears a dish.", inputSchema: { type: "object", properties: { dish: { type: "string" } } }, run: (i) => ({ cleared: i.dish }) });
}