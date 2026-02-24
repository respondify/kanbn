import type {
  UserWebhookMethod,
  UserWebhookSubscriptionType,
} from "@kan/db/schema";
import type { dbClient } from "@kan/db/client";
import * as userWebhookSubscriptionRepo from "@kan/db/repository/userWebhookSubscription.repo";

export async function dispatchUserWebhooks(args: {
  db: dbClient;
  userIds: string[];
  type: UserWebhookSubscriptionType;
  variables: {
    cardPublicId: string;
  };
  payload?: Record<string, unknown>;
}) {
  const { db, userIds, type, variables, payload } = args;
  if (userIds.length === 0) return;

  // For now, fetch subscriptions per user sequentially (small N). If needed, we
  // can optimize with a single query later.
  await Promise.all(
    userIds.map(async (userId) => {
      const subs = await userWebhookSubscriptionRepo.listActiveByUserIdAndType(
        db,
        { userId, type },
      );

      await Promise.all(
        subs.map(async (sub) => {
          const url = expandTemplate(sub.callbackUrlTemplate, variables);
          const method = sub.method as UserWebhookMethod;
          const headers: Record<string, string> = {};

          const cred = (sub as any).credential as
            | {
                authType: "bearer";
                bearerToken: string;
                headerName: string;
              }
            | null
            | undefined;

          if (cred?.authType === "bearer") {
            headers[cred.headerName || "Authorization"] = `Bearer ${cred.bearerToken}`;
          }

          // Fire-and-forget with a short timeout.
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 2500);

            if (method === "GET") {
              await fetch(url, {
                method: "GET",
                headers,
                signal: ctrl.signal,
              });
            } else {
              headers["Content-Type"] = "application/json";
              await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(payload ?? variables),
                signal: ctrl.signal,
              });
            }

            clearTimeout(t);
          } catch (error) {
            // Don't fail the core mutation path.
            console.error("Webhook dispatch failed", {
              type,
              url,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }),
      );
    }),
  );
}

function expandTemplate(template: string, vars: { cardPublicId: string }): string {
  return template.replaceAll("{cardPublicId}", encodeURIComponent(vars.cardPublicId));
}
