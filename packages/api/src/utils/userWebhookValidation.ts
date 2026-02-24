import { TRPCError } from "@trpc/server";
import { env } from "next-runtime-env";

import type { UserWebhookSubscriptionType } from "@kan/db/schema";

const PLACEHOLDERS_BY_TYPE: Record<UserWebhookSubscriptionType, string[]> = {
  assigned: ["{cardPublicId}"],
  unassigned: ["{cardPublicId}"],
  associated_card_changes: ["{cardPublicId}"],
};

export function getAllowedWebhookOrigins(): string[] {
  const raw = env("KAN_WEBHOOK_ALLOWED_ORIGINS")?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateCallbackUrlTemplate(args: {
  type: UserWebhookSubscriptionType;
  template: string;
}) {
  const { type, template } = args;

  const allowedOrigins = getAllowedWebhookOrigins();
  if (allowedOrigins.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Webhook callbacks are not configured. Ask an admin to set KAN_WEBHOOK_ALLOWED_ORIGINS.",
    });
  }

  const allowedPlaceholders = PLACEHOLDERS_BY_TYPE[type] ?? [];

  const placeholderMatches = template.match(/\{[a-zA-Z0-9_]+\}/g) ?? [];
  const unique = Array.from(new Set(placeholderMatches));

  if (unique.length !== 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "callbackUrlTemplate must contain exactly one placeholder (e.g. {cardPublicId}).",
    });
  }

  const placeholder = unique[0];
  if (!allowedPlaceholders.includes(placeholder)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid placeholder ${placeholder} for type ${type}. Allowed: ${allowedPlaceholders.join(
        ", ",
      )}`,
    });
  }

  // Parse URL after substitution.
  const parsed = safeParseUrl(template.replace(placeholder, "DUMMY"));

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "callbackUrlTemplate must be http(s).",
    });
  }

  const origin = parsed.origin;
  if (!allowedOrigins.includes(origin)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Webhook callback origin not allowlisted: ${origin}`,
    });
  }
}

function safeParseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "callbackUrlTemplate must be a valid URL.",
    });
  }
}
