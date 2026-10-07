import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function md5Hex(data) {
  return createHash("md5").update(data).digest("hex");
}

export async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
