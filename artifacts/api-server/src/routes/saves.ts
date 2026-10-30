import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, cloudSavesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import {
  SaveDataSchema,
  hasPrototypePollution,
  computePayloadChecksum,
  MAX_PAYLOAD_BYTES,
} from "../lib/saveValidator";

const router: IRouter = Router();

// Require authenticated session for all cloud save operations
router.use(requireAuth);

/**
 * GET /api/saves
 * Retrieves the authenticated player's latest cloud save record.
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const [save] = await db
      .select()
      .from(cloudSavesTable)
      .where(eq(cloudSavesTable.userId, userId))
      .limit(1);

    if (!save) {
      res.status(404).json({
        error: "NOT_FOUND",
        message: "No cloud save found for this player.",
      });
      return;
    }

    res.status(200).json({ save });
  } catch (err) {
    req.log?.error({ err }, "Failed to retrieve cloud save");
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred while fetching cloud save.",
    });
  }
});

/**
 * PUT /api/saves
 * Uploads or updates cloud save with atomic optimistic concurrency check.
 */
router.put("/", async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Check size limits
    const rawContentLength = req.headers["content-length"];
    if (rawContentLength && parseInt(rawContentLength, 10) > MAX_PAYLOAD_BYTES) {
      res.status(413).json({
        error: "PAYLOAD_TOO_LARGE",
        message: `Save payload exceeds maximum size limit of ${MAX_PAYLOAD_BYTES / 1024} KB.`,
      });
      return;
    }

    // 2. Reject prototype pollution attempts
    if (hasPrototypePollution(req.body)) {
      res.status(400).json({
        error: "INVALID_PAYLOAD",
        message: "Invalid payload: suspicious prototype property detected.",
      });
      return;
    }

    const { expectedRevision, clientSavedAt, payload } = req.body;

    if (typeof expectedRevision !== "number" || expectedRevision < 0 || !Number.isInteger(expectedRevision)) {
      res.status(400).json({
        error: "INVALID_PARAMETERS",
        message: "expectedRevision must be a non-negative integer.",
      });
      return;
    }

    if (typeof clientSavedAt !== "number" || clientSavedAt < 0) {
      res.status(400).json({
        error: "INVALID_PARAMETERS",
        message: "clientSavedAt must be a valid positive timestamp.",
      });
      return;
    }

    // 3. Validate SaveData structure strictly
    const parseResult = SaveDataSchema.safeParse(payload);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Validation failed";
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: `Invalid save data: ${detail}`,
      });
      return;
    }

    const validatedPayload = parseResult.data;
    const checksum = computePayloadChecksum(validatedPayload);
    const userId = req.user!.id;

    // 4. Concurrency Case A: First-time save creation (expectedRevision === 0)
    if (expectedRevision === 0) {
      const [inserted] = await db
        .insert(cloudSavesTable)
        .values({
          userId,
          saveVersion: validatedPayload.version ?? 1,
          revision: 1,
          payload: validatedPayload,
          checksum,
          clientSavedAt,
        })
        .onConflictDoNothing({ target: cloudSavesTable.userId })
        .returning();

      if (inserted) {
        res.status(201).json({ save: inserted });
        return;
      }

      // If insertion yielded 0 rows, a save already exists (race condition)
      const [existing] = await db
        .select()
        .from(cloudSavesTable)
        .where(eq(cloudSavesTable.userId, userId))
        .limit(1);

      res.status(409).json({
        error: "CONFLICT",
        message: "Initial cloud save already exists. A concurrent request created revision 1.",
        currentRevision: existing.revision,
        serverSavedAt: existing.updatedAt.toISOString(),
        cloudSave: existing,
      });
      return;
    }

    // 5. Concurrency Case B: Subsequent save update (expectedRevision > 0)
    const [updated] = await db
      .update(cloudSavesTable)
      .set({
        revision: sql`${cloudSavesTable.revision} + 1`,
        payload: validatedPayload,
        checksum,
        clientSavedAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cloudSavesTable.userId, userId),
          eq(cloudSavesTable.revision, expectedRevision),
        ),
      )
      .returning();

    if (updated) {
      res.status(200).json({ save: updated });
      return;
    }

    // Update returned 0 rows: either save doesn't exist, or revision mismatched
    const [current] = await db
      .select()
      .from(cloudSavesTable)
      .where(eq(cloudSavesTable.userId, userId))
      .limit(1);

    if (!current) {
      res.status(404).json({
        error: "NOT_FOUND",
        message: "No cloud save found for this user to update. Use expectedRevision 0 for initial save.",
      });
      return;
    }

    res.status(409).json({
      error: "CONFLICT",
      message: `Cloud save revision conflict: server has revision ${current.revision}, expected ${expectedRevision}.`,
      currentRevision: current.revision,
      serverSavedAt: current.updatedAt.toISOString(),
      cloudSave: current,
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to update cloud save");
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred while updating cloud save.",
    });
  }
});

/**
 * POST /api/saves/resolve-conflict
 * Explicitly resolves a detected revision conflict.
 */
router.post("/resolve-conflict", async (req: Request, res: Response): Promise<void> => {
  try {
    const { resolution, baseRevision, payload } = req.body;

    if (resolution !== "keep_local" && resolution !== "keep_cloud") {
      res.status(400).json({
        error: "INVALID_PARAMETERS",
        message: "resolution must be either 'keep_local' or 'keep_cloud'.",
      });
      return;
    }

    if (typeof baseRevision !== "number" || baseRevision < 1 || !Number.isInteger(baseRevision)) {
      res.status(400).json({
        error: "INVALID_PARAMETERS",
        message: "baseRevision must be a positive integer.",
      });
      return;
    }

    const userId = req.user!.id;

    // Verify current server state
    const [current] = await db
      .select()
      .from(cloudSavesTable)
      .where(eq(cloudSavesTable.userId, userId))
      .limit(1);

    if (!current) {
      res.status(404).json({
        error: "NOT_FOUND",
        message: "No cloud save found to resolve conflict for.",
      });
      return;
    }

    // Stale check: if current revision differs from the revision the client viewed
    if (current.revision !== baseRevision) {
      res.status(409).json({
        error: "CONFLICT",
        message: `Cloud save revision changed to ${current.revision} since conflict was displayed.`,
        currentRevision: current.revision,
        serverSavedAt: current.updatedAt.toISOString(),
        cloudSave: current,
      });
      return;
    }

    // Option A: Keep local progress -> Force update server with incremented revision
    if (resolution === "keep_local") {
      if (!payload) {
        res.status(400).json({
          error: "INVALID_PARAMETERS",
          message: "payload is required when resolution is 'keep_local'.",
        });
        return;
      }

      if (hasPrototypePollution(payload)) {
        res.status(400).json({
          error: "INVALID_PAYLOAD",
          message: "Invalid payload: suspicious prototype property detected.",
        });
        return;
      }

      const parseResult = SaveDataSchema.safeParse(payload);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Validation failed";
        res.status(400).json({
          error: "VALIDATION_ERROR",
          message: `Invalid save data: ${detail}`,
        });
        return;
      }

      const validatedPayload = parseResult.data;
      const checksum = computePayloadChecksum(validatedPayload);

      const [updated] = await db
        .update(cloudSavesTable)
        .set({
          revision: sql`${cloudSavesTable.revision} + 1`,
          payload: validatedPayload,
          checksum,
          clientSavedAt: validatedPayload.savedAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(cloudSavesTable.userId, userId),
            eq(cloudSavesTable.revision, baseRevision),
          ),
        )
        .returning();

      if (!updated) {
        res.status(409).json({
          error: "CONFLICT",
          message: "Concurrent modification during conflict resolution.",
          currentRevision: current.revision,
          serverSavedAt: current.updatedAt.toISOString(),
          cloudSave: current,
        });
        return;
      }

      res.status(200).json({ save: updated });
      return;
    }

    // Option B: Keep cloud save -> Return current cloud save record as authoritative
    res.status(200).json({ save: current });
  } catch (err) {
    req.log?.error({ err }, "Failed to resolve save conflict");
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred while resolving save conflict.",
    });
  }
});

export default router;

