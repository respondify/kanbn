import { and, eq, isNull } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { userWebhookCredentials } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export const listByUserId = async (db: dbClient, userId: string) => {
  return db.query.userWebhookCredentials.findMany({
    where: and(
      eq(userWebhookCredentials.userId, userId),
      isNull(userWebhookCredentials.deletedAt),
    ),
    orderBy: (t, { desc }) => desc(t.createdAt),
  });
};

export const create = async (
  db: dbClient,
  args: {
    userId: string;
    name: string;
    bearerToken: string;
    headerName?: string;
  },
) => {
  const [result] = await db
    .insert(userWebhookCredentials)
    .values({
      publicId: generateUID(),
      userId: args.userId,
      name: args.name,
      authType: "bearer",
      bearerToken: args.bearerToken,
      headerName: args.headerName ?? "Authorization",
      createdAt: new Date(),
    })
    .returning();

  return result;
};

export const getByPublicIdForUser = async (
  db: dbClient,
  args: { userId: string; publicId: string },
) => {
  return db.query.userWebhookCredentials.findFirst({
    where: and(
      eq(userWebhookCredentials.userId, args.userId),
      eq(userWebhookCredentials.publicId, args.publicId),
      isNull(userWebhookCredentials.deletedAt),
    ),
  });
};

export const softDeleteByPublicIdForUser = async (
  db: dbClient,
  args: { userId: string; publicId: string },
) => {
  const [result] = await db
    .update(userWebhookCredentials)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(userWebhookCredentials.userId, args.userId),
        eq(userWebhookCredentials.publicId, args.publicId),
        isNull(userWebhookCredentials.deletedAt),
      ),
    )
    .returning({ publicId: userWebhookCredentials.publicId });

  return result;
};
