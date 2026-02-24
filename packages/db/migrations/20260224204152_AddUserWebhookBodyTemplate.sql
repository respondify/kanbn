ALTER TABLE "user_webhook_subscriptions"
  ADD COLUMN IF NOT EXISTS "bodyJsonTemplate" text;
