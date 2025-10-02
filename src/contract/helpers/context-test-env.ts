import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "../../..");
const tmpRoot = join(projectRoot, "tmp");

export const orckaBin = join(projectRoot, "bin/orcka.cjs");

export const createPersistentContextWorkspace = (
  name: string,
): {
  path: string;
  prepare: () => void;
  cleanup: () => void;
} => {
  const path = join(tmpRoot, name);

  const cleanup = () => {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
    }
  };

  const prepare = () => {
    cleanup();
    mkdirSync(path, { recursive: true });
  };

  return { path, prepare, cleanup };
};

export const createEphemeralContextWorkspace = (prefix: string): { path: string; cleanup: () => void } => {
  const path = mkdtempSync(join(tmpdir(), `${prefix}-`));

  const cleanup = () => {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
    }
  };

  return { path, cleanup };
};
