import { writeFile, readFile, copyFile } from "node:fs/promises";
import { DefaultContradictionPolicy } from "../policy/contradiction-policy";
import type { MemoryRecordV2 } from "../types/memory";

const CONTRADICTIONS_PATH = "/root/.openclaw/workspace/agents/registry/contradictions.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/contradictions.guard.backup.json";

async function main() {
  await copyFile(CONTRADICTIONS_PATH, BACKUP_PATH);

  try {
    await writeFile(CONTRADICTIONS_PATH, JSON.stringify({ broken: true }, null, 2) + "\n", "utf8");

    const policy = new DefaultContradictionPolicy();
    const older: MemoryRecordV2 = {
      schemaVersion: "2.0",
      memoryId: "mem_old",
      canonicalKey: "react:deployment:pattern-x",
      memoryScope: "company",
      visibility: "shared",
      status: "active",
      verificationState: "provisional",
      confidence: 0.6,
      timestamp: "2026-03-20T00:00:00Z",
      content: "Use old pattern X",
      summary: "Old pattern",
    };
    const newer: MemoryRecordV2 = {
      schemaVersion: "2.0",
      memoryId: "mem_new",
      canonicalKey: "react:deployment:pattern-x",
      memoryScope: "company",
      visibility: "shared",
      status: "active",
      verificationState: "verified",
      confidence: 0.9,
      timestamp: "2026-03-25T00:00:00Z",
      content: "Use new pattern X2",
      summary: "New pattern",
    };

    const record = await policy.record(older, newer);
    console.log(JSON.stringify({ record }, null, 2));
  } finally {
    const original = await readFile(BACKUP_PATH, "utf8");
    await writeFile(CONTRADICTIONS_PATH, original, "utf8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
