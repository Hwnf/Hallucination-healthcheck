import { writeFile, readFile, copyFile } from "node:fs/promises";
import { RegistryLoader } from "../registries/registry-loader";

const PROJECTS_PATH = "/root/.openclaw/workspace/agents/registry/projects.json";
const BACKUP_PATH = "/root/.openclaw/workspace/plugin/tests/fixtures/projects.schema-compat.backup.json";

async function main() {
  await copyFile(PROJECTS_PATH, BACKUP_PATH);

  try {
    const raw = await readFile(PROJECTS_PATH, "utf8");
    const projects = JSON.parse(raw);
    if (Array.isArray(projects) && projects[0] && typeof projects[0] === "object") {
      projects[0].schema_version = "1.0";
    }
    await writeFile(PROJECTS_PATH, JSON.stringify(projects, null, 2) + "\n", "utf8");

    const loader = new RegistryLoader();
    const bundle = await loader.loadAll();
    const health = loader.health();

    console.log(JSON.stringify({
      projectsLength: bundle.projects.length,
      health,
      schemaIssues: health.issues.filter((issue) => issue.registry === "projects"),
    }, null, 2));
  } finally {
    const original = await readFile(BACKUP_PATH, "utf8");
    await writeFile(PROJECTS_PATH, original, "utf8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
