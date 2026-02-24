export type LocalUploadKind = "avatars" | "attachments";

export function toPublicUploadPath(
  kind: LocalUploadKind,
  relativeKey: string,
): string {
  const cleaned = relativeKey.replace(/^\/+/, "");
  return `/uploads/${kind}/${cleaned}`;
}

export function isLocalUploadPath(key: string): boolean {
  return key.startsWith("/uploads/") || key.startsWith("uploads/");
}

export function tryParseLocalUploadKind(key: string): LocalUploadKind | null {
  const cleaned = key.replace(/^\/+/, "");
  if (cleaned.startsWith("uploads/avatars/")) return "avatars";
  if (cleaned.startsWith("uploads/attachments/")) return "attachments";
  return null;
}

export function stripUploadsPrefix(kind: LocalUploadKind, key: string): string {
  const cleaned = key.replace(/^\/+/, "");
  const prefix = `uploads/${kind}/`;
  return cleaned.startsWith(prefix) ? cleaned.slice(prefix.length) : cleaned;
}
