import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const userWebhookAuthTypes = ["bearer"] as const;
export type UserWebhookAuthType = (typeof userWebhookAuthTypes)[number];
export const userWebhookAuthTypeEnum = pgEnum(
  "user_webhook_auth_type",
  userWebhookAuthTypes,
);

export const userWebhookMethods = ["GET", "POST"] as const;
export type UserWebhookMethod = (typeof userWebhookMethods)[number];
export const userWebhookMethodEnum = pgEnum(
  "user_webhook_method",
  userWebhookMethods,
);

export const userWebhookSubscriptionTypes = [
  "assigned",
  "unassigned",
  "associated_card_changes",
] as const;
export type UserWebhookSubscriptionType =
  (typeof userWebhookSubscriptionTypes)[number];
export const userWebhookSubscriptionTypeEnum = pgEnum(
  "user_webhook_subscription_type",
  userWebhookSubscriptionTypes,
);

export const userWebhookCredentials = pgTable(
  "user_webhook_credentials",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),

    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
    authType: userWebhookAuthTypeEnum("authType").notNull(),

    // NOTE: Stored in DB for now. If you need stronger guarantees, move to a
    // dedicated secrets store or encrypt-at-rest.
    bearerToken: text("bearerToken").notNull(),

    headerName: varchar("headerName", { length: 255 })
      .notNull()
      .default("Authorization"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
    deletedAt: timestamp("deletedAt"),
  },
  (table) => [index("user_webhook_credentials_user_idx").on(table.userId)],
).enableRLS();

export const userWebhookSubscriptions = pgTable(
  "user_webhook_subscriptions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),

    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    type: userWebhookSubscriptionTypeEnum("type").notNull(),
    method: userWebhookMethodEnum("method").notNull().default("POST"),

    callbackUrlTemplate: varchar("callbackUrlTemplate", {
      length: 2048,
    }).notNull(),

    credentialId: bigint("credentialId", { mode: "number" }).references(
      () => userWebhookCredentials.id,
      { onDelete: "set null" },
    ),

    enabled: boolean("enabled").notNull().default(true),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
    deletedAt: timestamp("deletedAt"),
  },
  (table) => [
    index("user_webhook_subscriptions_user_idx").on(table.userId),
    index("user_webhook_subscriptions_type_idx").on(table.type),
  ],
).enableRLS();

export const userWebhookCredentialsRelations = relations(
  userWebhookCredentials,
  ({ one, many }) => ({
    user: one(users, {
      fields: [userWebhookCredentials.userId],
      references: [users.id],
      relationName: "userWebhookCredentialsUser",
    }),
    subscriptions: many(userWebhookSubscriptions, {
      relationName: "userWebhookCredentialsSubscriptions",
    }),
  }),
);

export const userWebhookSubscriptionsRelations = relations(
  userWebhookSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [userWebhookSubscriptions.userId],
      references: [users.id],
      relationName: "userWebhookSubscriptionsUser",
    }),
    credential: one(userWebhookCredentials, {
      fields: [userWebhookSubscriptions.credentialId],
      references: [userWebhookCredentials.id],
      relationName: "userWebhookSubscriptionsCredential",
    }),
  }),
);
