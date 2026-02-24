CREATE TYPE "public"."user_webhook_auth_type" AS ENUM('bearer');
--> statement-breakpoint
CREATE TYPE "public"."user_webhook_method" AS ENUM('GET', 'POST');
--> statement-breakpoint
CREATE TYPE "public"."user_webhook_subscription_type" AS ENUM('assigned', 'unassigned', 'associated_card_changes');
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_webhook_credentials" (
  "id" bigserial PRIMARY KEY,
  "publicId" varchar(12) NOT NULL,
  "userId" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "authType" "user_webhook_auth_type" NOT NULL,
  "bearerToken" text NOT NULL,
  "headerName" varchar(255) NOT NULL DEFAULT 'Authorization',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp,
  "deletedAt" timestamp,
  CONSTRAINT "user_webhook_credentials_publicId_unique" UNIQUE("publicId"),
  CONSTRAINT "user_webhook_credentials_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_webhook_credentials_user_idx" ON "user_webhook_credentials" USING btree ("userId");
--> statement-breakpoint
ALTER TABLE "user_webhook_credentials" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_webhook_subscriptions" (
  "id" bigserial PRIMARY KEY,
  "publicId" varchar(12) NOT NULL,
  "userId" uuid NOT NULL,
  "type" "user_webhook_subscription_type" NOT NULL,
  "method" "user_webhook_method" NOT NULL DEFAULT 'POST',
  "callbackUrlTemplate" varchar(2048) NOT NULL,
  "credentialId" bigint,
  "enabled" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp,
  "deletedAt" timestamp,
  CONSTRAINT "user_webhook_subscriptions_publicId_unique" UNIQUE("publicId"),
  CONSTRAINT "user_webhook_subscriptions_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "user_webhook_subscriptions_credentialId_user_webhook_credentials_id_fk" FOREIGN KEY ("credentialId") REFERENCES "public"."user_webhook_credentials"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_webhook_subscriptions_user_idx" ON "user_webhook_subscriptions" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_webhook_subscriptions_type_idx" ON "user_webhook_subscriptions" USING btree ("type");
--> statement-breakpoint
ALTER TABLE "user_webhook_subscriptions" ENABLE ROW LEVEL SECURITY;
