import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeJsonAtomic } from "../../scripts/lib/io.mjs";

describe("writeJsonAtomic", () => {
  it("ecrit un JSON lisible et ne laisse pas de fichier temporaire", () => {
    const dir = mkdtempSync(join(tmpdir(), "coran-"));
    const path = join(dir, "out.json");
    writeJsonAtomic(path, { a: 1 });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ a: 1 });
    expect(readdirSync(dir)).toEqual(["out.json"]);
  });

  it("n'ecrit rien si la serialisation echoue", () => {
    const dir = mkdtempSync(join(tmpdir(), "coran-"));
    const path = join(dir, "out.json");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => writeJsonAtomic(path, cyclic)).toThrow();
    expect(readdirSync(dir)).toEqual([]);
  });
});
