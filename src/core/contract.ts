// The Contract: what the person has accepted on the Business, Requirements and Architecture layers (the files, never pending
// Proposals), in a compact form for the builder, plus a completeness indicator. The indicator only describes; it never blocks.
import { loadAuthored } from "./authored.ts";

type Fields = Record<string, unknown>;
const pick = (n: Fields, keys: string[]) => Object.fromEntries(keys.filter((k) => n[k] !== undefined).map((k) => [k, n[k]]));

// What the builder is told when its session starts.
export const BUILDER_INSTRUCTIONS =
  "This Project has a Contract: what the person accepted on the Business, Requirements and Architecture layers. " +
  "Before you build or change anything, call the aidea tool `read_contract` and follow what it returns. " +
  "You work from the Contract and you do not change it: do not invent, and take no important decision that the Contract does not already hold. " +
  "If the work needs something the Contract lacks, or needs to depart from it, stop: say in the chat exactly what is missing and wait. The person decides; you never propose changes to the layers.";

export function contractOf(projectPath: string) {
  const { layers } = loadAuthored(projectPath);
  const business: Record<string, Fields[]> = {};
  for (const n of layers.business.nodes) (business[n.block as string] ??= []).push(pick(n, ["id", "title", "rationale"]));
  const requirements = layers.requirements.nodes.map((n) =>
    n.kind === "non-functional"
      ? pick(n, ["id", "title", "kind", "statement", "quality", "measure", "rationale"])
      : { ...pick(n, ["id", "title"]), kind: "functional", ...pick(n, ["as", "want", "so", "criteria", "rationale"]) });
  const architecture = layers.architecture.nodes.map((n) => pick(n, ["id", "title", "kind", "technology", "description", "parent", "external", "relations", "rationale"]));

  const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const check = (id: string, label: string, n: number, text: string) => ({ id, met: n > 0, text: `${label}: ${n ? text : "nothing written yet"}` });
  const functional = requirements.filter((r) => r.kind === "functional");
  const withCriteria = functional.filter((r) => Array.isArray(r.criteria) && r.criteria.length > 0).length;
  const containers = architecture.filter((a) => a.kind === "container").length;
  const readiness = [
    check("customer-segments", "Customer segments", business["customer segments"]?.length ?? 0, count(business["customer segments"]?.length ?? 0, "note")),
    check("value-proposition", "Value proposition", business["value propositions"]?.length ?? 0, count(business["value propositions"]?.length ?? 0, "note")),
    check("functional-requirement", "Functional requirements", functional.length, String(functional.length)),
    check("non-functional-requirement", "Non-functional requirements", requirements.length - functional.length, String(requirements.length - functional.length)),
    {
      id: "criteria", met: functional.length > 0 && withCriteria === functional.length,
      text: `Acceptance criteria: ${functional.length ? `${withCriteria} of ${functional.length} functional requirements have them` : "no functional requirements yet"}`,
    },
    check("containers", "Containers", containers, String(containers)),
  ];
  return { layers: { business, requirements, architecture }, readiness };
}
