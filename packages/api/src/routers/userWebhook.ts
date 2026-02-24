import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as userWebhookCredentialRepo from "@kan/db/repository/userWebhookCredential.repo";
import * as userWebhookSubscriptionRepo from "@kan/db/repository/userWebhookSubscription.repo";
import {
  userWebhookSubscriptionTypes,
  userWebhookMethods,
} from "@kan/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { validateCallbackUrlTemplate } from "../utils/userWebhookValidation";

export const userWebhookRouter = createTRPCRouter({
  // Credentials
  listCredentials: protectedProcedure
    .meta({
      openapi: {
        summary: "List webhook credentials",
        method: "GET",
        path: "/webhook-credentials",
        tags: ["Webhooks"],
        protect: true,
      },
    })
    .input(z.void())
    .output(
      z.array(
        z.object({
          publicId: z.string(),
          name: z.string(),
          authType: z.literal("bearer"),
          headerName: z.string(),
          createdAt: z.date(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const creds = await userWebhookCredentialRepo.listByUserId(ctx.db, userId);

      // Never return bearer tokens.
      return creds.map((c) => ({
        publicId: c.publicId,
        name: c.name,
        authType: "bearer" as const,
        headerName: c.headerName,
        createdAt: c.createdAt,
      }));
    }),

  createCredential: protectedProcedure
    .meta({
      openapi: {
        summary: "Create webhook credential",
        method: "POST",
        path: "/webhook-credentials",
        tags: ["Webhooks"],
        protect: true,
      },
    })
    .input(
      z.object({
        name: z.string().min(1).max(255),
        bearerToken: z.string().min(1),
        headerName: z.string().min(1).max(255).optional(),
      }),
    )
    .output(
      z.object({
        publicId: z.string(),
        name: z.string(),
        authType: z.literal("bearer"),
        headerName: z.string(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const cred = await userWebhookCredentialRepo.create(ctx.db, {
        userId,
        name: input.name,
        bearerToken: input.bearerToken,
        headerName: input.headerName,
      });

      if (!cred)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create credential",
        });

      return {
        publicId: cred.publicId,
        name: cred.name,
        authType: "bearer" as const,
        headerName: cred.headerName,
        createdAt: cred.createdAt,
      };
    }),

  deleteCredential: protectedProcedure
    .meta({
      openapi: {
        summary: "Delete webhook credential",
        method: "DELETE",
        path: "/webhook-credentials/{credentialPublicId}",
        tags: ["Webhooks"],
        protect: true,
      },
    })
    .input(z.object({ credentialPublicId: z.string().min(12) }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const deleted = await userWebhookCredentialRepo.softDeleteByPublicIdForUser(
        ctx.db,
        { userId, publicId: input.credentialPublicId },
      );

      if (!deleted)
        throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });

      return { success: true };
    }),

  // Subscriptions
  listSubscriptions: protectedProcedure
    .meta({
      openapi: {
        summary: "List webhook subscriptions",
        method: "GET",
        path: "/webhook-subscriptions",
        tags: ["Webhooks"],
        protect: true,
      },
    })
    .input(z.void())
    .output(
      z.array(
        z.object({
          publicId: z.string(),
          type: z.enum(userWebhookSubscriptionTypes),
          method: z.enum(userWebhookMethods),
          callbackUrlTemplate: z.string(),
          bodyJsonTemplate: z.string().nullable(),
          enabled: z.boolean(),
          credentialPublicId: z.string().nullable(),
          createdAt: z.date(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const subs = await userWebhookSubscriptionRepo.listByUserId(ctx.db, userId);

      return subs.map((s: any) => ({
        publicId: s.publicId,
        type: s.type,
        method: s.method,
        callbackUrlTemplate: s.callbackUrlTemplate,
        bodyJsonTemplate: s.bodyJsonTemplate ?? null,
        enabled: s.enabled,
        credentialPublicId: s.credential?.publicId ?? null,
        createdAt: s.createdAt,
      }));
    }),

  createSubscription: protectedProcedure
    .meta({
      openapi: {
        summary: "Create webhook subscription",
        method: "POST",
        path: "/webhook-subscriptions",
        tags: ["Webhooks"],
        protect: true,
      },
    })
    .input(
      z.object({
        type: z.enum(userWebhookSubscriptionTypes),
        method: z.enum(userWebhookMethods).default("POST"),
        callbackUrlTemplate: z.string().min(1).max(2048),
        bodyJsonTemplate: z.string().max(20000).nullable().optional(),
        credentialPublicId: z.string().min(12).nullable().optional(),
      }),
    )
    .output(
      z.object({
        publicId: z.string(),
        type: z.enum(userWebhookSubscriptionTypes),
        method: z.enum(userWebhookMethods),
        callbackUrlTemplate: z.string(),
        enabled: z.boolean(),
        credentialPublicId: z.string().nullable(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      validateCallbackUrlTemplate({ type: input.type, template: input.callbackUrlTemplate });

      const credentialId = input.credentialPublicId
        ? await userWebhookSubscriptionRepo.getCredentialIdByPublicIdForUser(
            ctx.db,
            { userId, credentialPublicId: input.credentialPublicId },
          )
        : null;

      if (input.credentialPublicId && !credentialId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Credential not found" });
      }

      const sub = await userWebhookSubscriptionRepo.create(ctx.db, {
        userId,
        type: input.type,
        method: input.method,
        callbackUrlTemplate: input.callbackUrlTemplate,
        bodyJsonTemplate: input.bodyJsonTemplate ?? null,
        credentialId,
      });

      if (!sub)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create subscription",
        });

      return {
        publicId: sub.publicId,
        type: sub.type,
        method: sub.method,
        callbackUrlTemplate: sub.callbackUrlTemplate,
        bodyJsonTemplate: sub.bodyJsonTemplate ?? null,
        enabled: sub.enabled,
        credentialPublicId: input.credentialPublicId ?? null,
        createdAt: sub.createdAt,
      };
    }),

  deleteSubscription: protectedProcedure
    .meta({
      openapi: {
        summary: "Delete webhook subscription",
        method: "DELETE",
        path: "/webhook-subscriptions/{subscriptionPublicId}",
        tags: ["Webhooks"],
        protect: true,
      },
    })
    .input(z.object({ subscriptionPublicId: z.string().min(12) }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const deleted = await userWebhookSubscriptionRepo.softDeleteByPublicIdForUser(
        ctx.db,
        { userId, publicId: input.subscriptionPublicId },
      );

      if (!deleted)
        throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });

      return { success: true };
    }),
});
