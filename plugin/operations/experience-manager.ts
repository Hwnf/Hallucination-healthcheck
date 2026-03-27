import { readFile } from "node:fs/promises";
import { writeJsonAtomic } from "../registries/atomic-file";

const EXPERIENCE_INDEX_PATH = "/root/.openclaw/workspace/agents/registry/experience_index.json";

async function loadJsonArray(path: string): Promise<any[]> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveJson(path: string, data: unknown): Promise<void> {
  await writeJsonAtomic(path, data);
}

/**
 * Experience manager stub.
 *
 * Updates the experience index and can later be extended to modify markdown
 * experience files directly.
 */
export class DefaultExperienceManager {
  async recordLesson(owner: string, file: string, lessonKey: string): Promise<void> {
    const items = await loadJsonArray(EXPERIENCE_INDEX_PATH);
    const existing = items.find((x) => x.experience_owner === owner);

    if (existing) {
      const keys = new Set<string>(Array.isArray(existing.lesson_keys) ? existing.lesson_keys : []);
      keys.add(lessonKey);
      existing.lesson_keys = [...keys];
      existing.last_updated = new Date().toISOString();
    } else {
      items.push({
        experience_owner: owner,
        file,
        lesson_keys: [lessonKey],
        last_updated: new Date().toISOString(),
      });
    }

    await saveJson(EXPERIENCE_INDEX_PATH, items);
  }
}
