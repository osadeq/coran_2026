import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KFGQPC } from "../../scripts/lib/manifest.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FONT = join(ROOT, "src", "assets", "fonts", "kfgqpc_warsh_v30.ttf");

describe("police KFGQPC", () => {
  it("est presente avec la bonne empreinte", () => {
    const buf = readFileSync(FONT);
    expect(createHash("md5").update(buf).digest("hex")).toBe(KFGQPC.ttf.md5);
  });

  it("a un en-tête TrueType valide", () => {
    const buf = readFileSync(FONT);
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x01, 0x00, 0x00]));
    expect(buf.length).toBeGreaterThan(200000);
  });
});
