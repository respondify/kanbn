import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import {
  userWebhookCredentials,
  userWebhookSubscriptions,
  type UserWebhookSubscriptionType,
} from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export const listByUserId = async (db: dbClient, userId: string) => {
  return db.query.userWebhookSubscriptions.findMany({
    where: and(
      eq(userWebhookSubscriptions.userId, userId),
      isNull(userWebhookSubscriptions.deletedAt),
    ),
    with: {
      credential: {
        columns: { publicId: true, name: true, headerName: true },
      },
    },
    orderBy: desc(userWebhookSubscriptions.createdAt),
  });
};

export const create = async (
  db: dbClient,
  args: {
    userId: string;
    type: UserWebhookSubscriptionType;
    method: "GET" | "POST";
    callbackUrlTemplate: string;
    credentialId: number | null;
  },
) => {
  const [result] = await db
    .insert(userWebhookSubscriptions)
    .values({
      publicId: generateUID(),
      userId: args.userId,
      type: args.type,
      method: args.method,
      callbackUrlTemplate: args.callbackUrlTemplate,
      credentialId: args.credentialId,
      enabled: true,
      createdAt: new Date(),
    })
    .returning();

  return result;
};

export const getByPublicIdForUser = async (
  db: dbClient,
  args: { userId: string; publicId: string },
) => {
  return db.query.userWebhookSubscriptions.findFirst({
    where: and(
      eq(userWebhookSubscriptions.userId, args.userId),
      eq(userWebhookSubscriptions.publicId, args.publicId),
      isNull(userWebhookSubscriptions.deletedAt),
    ),
  });
};

export const softDeleteByPublicIdForUser = async (
  db: dbClient,
  args: { userId: string; publicId: string },
) => {
  const [result] = await db
    .update(userWebhookSubscriptions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(userWebhookSubscriptions.userId, args.userId),
        eq(userWebhookSubscriptions.publicId, args.publicId),
        isNull(userWebhookSubscriptions.deletedAt),
      ),
    )
    .returning({ publicId: userWebhookSubscriptions.publicId });

  return result;
};

export const listActiveByUserIdAndType = async (
  db: dbClient,
  args: { userId: string; type: UserWebhookSubscriptionType },
) => {
  return db.query.userWebhookSubscriptions.findMany({
    where: and(
      eq(userWebhookSubscriptions.userId, args.userId),
      eq(userWebhookSubscriptions.type, args.type),
      eq(userWebhookSubscriptions.enabled, true),
      isNull(userWebhookSubscriptions.deletedAt),
    ),
    with: {
      credential: true,
    },
    orderBy: asc(userWebhookSubscriptions.createdAt),
  });
};

export const getCredentialIdByPublicIdForUser = async (
  db: dbClient,
  args: { userId: string; credentialPublicId: string },
) => {
  const result = await db
    .select({ id: userWebhookCredentials.id })
    .from(userWebhookCredentials)
    .where(
      and(
        eq(userWebhookCredentials.userId, args.userId),
        eq(userWebhookCredentials.publicId, args.credentialPublicId),
        isNull(userWebhookCredentials.deletedAt),
      ),
    );

  return result[0]?.id ?? null;
};
