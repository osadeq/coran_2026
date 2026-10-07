import { chmodSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
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

  it("cree les repertoires parents manquants", () => {
    const dir = mkdtempSync(join(tmpdir(), "coran-"));
    const path = join(dir, "timings", "120", "1.json");
    writeJsonAtomic(path, { a: 1 });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ a: 1 });
    expect(readdirSync(join(dir, "timings", "120"))).toEqual(["1.json"]);
  });

  // Seul Windows refuse le rename sur un fichier en lecture seule ; POSIX le remplace.
  it.skipIf(process.platform !== "win32")("quand le rename echoue, supprime le temporaire et conserve l'ancien fichier", () => {
    const dir = mkdtempSync(join(tmpdir(), "coran-"));
    const path = join(dir, "out.json");
    writeJsonAtomic(path, { a: 1 });
    // Windows: MoveFileEx refuse (EPERM) de remplacer un fichier marque en lecture
    // seule. C'est le plus sur moyen de faire echouer le rename apres coup, sans mock.
    chmodSync(path, 0o444);
    try {
      expect(() => writeJsonAtomic(path, { a: 2 })).toThrow();
      expect(readdirSync(dir)).toEqual(["out.json"]);
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ a: 1 });
    } finally {
      chmodSync(path, 0o666);
    }
  });
});
