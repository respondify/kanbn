import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import type { LocalUploadKind } from "./uploadPaths";
import { stripUploadsPrefix } from "./uploadPaths";

/**
 * Server-only local upload storage.
 *
 * Stores uploaded files under apps/web/public/uploads so that Next.js and nginx
 * can serve them as static files.
 */

export function getLocalUploadsRoot(): string {
  // systemd service sets WorkingDirectory to repo root
  return path.join(process.cwd(), "apps", "web", "public", "uploads");
}

export function resolveLocalUploadFilePath(
  kind: LocalUploadKind,
  relativeKey: string,
): string {
  return path.join(getLocalUploadsRoot(), kind, relativeKey.replace(/^\/+/, ""));
}

export async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true });
}

export async function saveRequestBodyToFile(
  req: NodeJS.ReadableStream,
  outFilePath: string,
): Promise<void> {
  await ensureDir(path.dirname(outFilePath));
  const tmp = `${outFilePath}.tmp-${Date.now()}`;

  const writeStream = fs.createWriteStream(tmp, { flags: "wx" });
  try {
    await pipeline(req, writeStream);
    await fsp.rename(tmp, outFilePath);
  } catch (err) {
    try {
      await fsp.rm(tmp, { force: true });
    } catch {
      // ignore
    }
    throw err;
  }
}

export async function deleteLocalUpload(kind: LocalUploadKind, key: string) {
  const relative = stripUploadsPrefix(kind, key);
  const filePath = resolveLocalUploadFilePath(kind, relative);
  await fsp.rm(filePath, { force: true });
}
