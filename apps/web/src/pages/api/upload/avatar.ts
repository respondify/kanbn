import type { NextApiRequest, NextApiResponse } from "next";
import path from "node:path";

import { toPublicUploadPath } from "@kan/shared/utils";
import {
  resolveLocalUploadFilePath,
  saveRequestBodyToFile,
} from "@kan/shared/utils/uploadFs";

import { createNextApiContext } from "@kan/api/trpc";
import * as userRepo from "@kan/db/repository/user.repo";

import { withRateLimit } from "@kan/api/utils/rateLimit";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const allowedContentTypes = ["image/jpeg", "image/png", "image/webp"];

export const config = {
  api: {
    bodyParser: false,
  },
};

export default withRateLimit(
  { points: 100, duration: 60 },
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const { user, db } = await createNextApiContext(req);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Local filesystem storage (no S3 bucket required)

      const contentType = req.headers["content-type"];
      const contentLengthHeader = req.headers["content-length"];
      const contentLength = contentLengthHeader
        ? Number.parseInt(contentLengthHeader, 10)
        : NaN;

      if (typeof contentType !== "string") {
        return res.status(400).json({ error: "Missing content type" });
      }

      if (!allowedContentTypes.includes(contentType)) {
        return res.status(400).json({ error: "Invalid content type" });
      }

      if (!Number.isFinite(contentLength) || contentLength <= 0) {
        return res.status(400).json({ error: "Missing or invalid content length" });
      }

      if (contentLength > MAX_SIZE_BYTES) {
        return res.status(400).json({ error: "File too large" });
      }

      const originalFilenameHeader =
        (req.headers["x-original-filename"] as string | undefined) ?? "file";

      const sanitizedFilename = originalFilenameHeader
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .substring(0, 200);

      // Store avatars locally under the web public directory
      // /uploads/avatars/<userId>/<filename>
      const relativeKey = path.posix.join(user.id, sanitizedFilename);
      const outFilePath = resolveLocalUploadFilePath("avatars", relativeKey);

      await saveRequestBodyToFile(req, outFilePath);

      const publicPath = toPublicUploadPath("avatars", relativeKey);

      // Update user image in database (store public URL path)
      const updatedUser = await userRepo.update(db, user.id, {
        image: publicPath,
      });

      return res.status(200).json({
        key: publicPath,
        filename: sanitizedFilename,
        contentType,
        size: contentLength,
        user: updatedUser,
      });
    } catch (error) {
      console.error("Avatar upload failed", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

