import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { runPython } from "../src/core/python.ts";
import { fixture } from "./helpers.ts";

// SHA-256 of the exact analysis output of each fixture, taken before the analysis was sped up.
// A faster analysis must print the same bytes.
const GOLDEN: Record<string, string> = {
  shop: "baf3527a4ba6763d76a481f79acde9eec6f259d8282822f7053dd3ee99758bd2",
  relations: "c68eae138d392d56962bd50edb0a897f7e1afcb6cb3e65df22d0456bb2fc82f8",
  members: "472bae5515561b3fda50b9645b7f7cbd82255789e5f1c49eb753fde737d22902",
  flow: "953b2a09056e97ccae70e7b84a7f3ae1725c000982f26197dac97787c812bc28",
  params: "f10c095fe212067c97d7cbd01d125a743038006bd8e0e836562e78076ac181d4",
  playback: "f6048f2c73a366e68419db9220e940e79aa5b3e3589c70b4bf1913a8fc9efd27",
};

for (const [name, hash] of Object.entries(GOLDEN)) {
  test(`the analysis of the ${name} fixture is byte-for-byte what it always was`, async () => {
    const out = await runPython("analyze.py", [fixture(name)]);
    assert.equal(createHash("sha256").update(out).digest("hex"), hash);
  });
}
