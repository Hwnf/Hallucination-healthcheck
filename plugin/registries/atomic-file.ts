import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export interface AtomicFileFs {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, data: string, encoding: BufferEncoding): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string, options?: { force?: boolean }): Promise<void>;
}

const defaultFs: AtomicFileFs = {
  mkdir,
  writeFile: (path, data, encoding) => writeFile(path, data, encoding),
  rename,
  rm,
};

function dirname(path: string): string {
  return path.split("/").slice(0, -1).join("/") || ".";
}

export async function writeJsonAtomic(
  path: string,
  data: unknown,
  fsImpl: AtomicFileFs = defaultFs,
): Promise<void> {
  const dir = dirname(path);
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
  const payload = JSON.stringify(data, null, 2) + "\n";

  await fsImpl.mkdir(dir, { recursive: true });

  try {
    await fsImpl.writeFile(tempPath, payload, "utf8");
    await fsImpl.rename(tempPath, path);
  } catch (err) {
    await fsImpl.rm(tempPath, { force: true }).catch(() => {});
    throw err;
  }
}
