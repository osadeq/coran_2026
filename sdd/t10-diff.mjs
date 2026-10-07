import { readFileSync } from "node:fs";

const md = readFileSync("docs/superpowers/plans/2026-09-27-coran-socle.md", "utf8");
const sec = md.normalize("NFC").slice(
  md.normalize("NFC").indexOf("## Tâche 10"),
  md.normalize("NFC").indexOf("## Tâche 11"),
);
const blocks = [...sec.matchAll(/```tsx?\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
const [planTest, planImpl] = blocks;

function diff(a, b) {
  const A = a.replace(/\r/g, "").split("\n");
  const B = b.replace(/\r/g, "").split("\n");
  let i = 0, j = 0;
  const out = [];
  while (i < A.length || j < B.length) {
    if (A[i] === B[j]) { i++; j++; continue; }
    let found = false;
    for (let k = 1; k <= 8 && !found; k++) {
      if (A[i + k] === B[j]) {
        out.push("- A " + JSON.stringify(A[i])); i++; found = true;
      } else if (A[i] === B[j + k]) {
        out.push("+ B " + JSON.stringify(B[j])); j++; found = true;
      }
    }
    if (!found) {
      out.push("! A " + JSON.stringify(A[i] ?? "<eof>"));
      out.push("! B " + JSON.stringify(B[j] ?? "<eof>"));
      i++; j++;
    }
  }
  return out.length ? out.join("\n") : "IDENTICAL";
}

console.log("=== TEST (plan vs committed) ===");
console.log(diff(planTest, readFileSync("tests/unit/use-sync-engine.test.ts", "utf8")));
console.log("=== IMPL (plan vs committed) ===");
console.log(diff(planImpl, readFileSync("src/sync/use-sync-engine.ts", "utf8")));
