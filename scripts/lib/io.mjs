import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Un antivirus ou un indexer peut tenir la destination pendant quelques millisecondes :
// ces codes-la sont transitoires, les autres (EISDIR, ENOTEMPTY...) sont definitifs.
const TRANSIENT_RENAME_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
const RENAME_ATTEMPTS = 3;
const RENAME_DELAY_MS = 40;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      if (attempt >= RENAME_ATTEMPTS || !TRANSIENT_RENAME_CODES.has(error.code)) throw error;
      sleepSync(RENAME_DELAY_MS);
    }
  }
}

export function writeJsonAtomic(path, value) {
  const payload = JSON.stringify(value);
  mkdirSync(dirname(path), { recursive: true });
  // Nom unique : deux.coroutines sur le meme chemin ne partagent plus le temporaire, donc
  // le perdant ne supprime pas celui que le gagnant renome encore.
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tmp, payload, "utf8");
    renameWithRetry(tmp, path);
  } catch (error) {
    rmSync(tmp, { force: true });
    throw error;
  }
}
