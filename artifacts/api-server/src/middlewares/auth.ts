import type { Request, Response, NextFunction } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, usersTable, sessionsTable, type User, type Session } from "@workspace/db";
import { SESSION_COOKIE_NAME, hashToken } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

/**
 * Resolves session from cookie or Bearer header, validates expiry, and attaches user to req.
 */
export async function authenticateSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    let rawToken: string | undefined = req.cookies?.[SESSION_COOKIE_NAME];

    if (!rawToken && req.headers.authorization?.startsWith("Bearer ")) {
      rawToken = req.headers.authorization.slice(7).trim();
    }

    if (!rawToken) {
      return next();
    }

    const tokenHash = hashToken(rawToken);
    const now = new Date();

    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(and(eq(sessionsTable.id, tokenHash), gt(sessionsTable.expiresAt, now)))
      .limit(1);

    if (!session) {
      return next();
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);

    if (user) {
      req.user = user;
      req.session = session;
    }

    next();
  } catch (err) {
    // If database is temporarily unavailable, pass through as unauthenticated guest
    next();
  }
}

/**
 * Middleware that strictly enforces authenticated user presence.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.session) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Authentication required to access this resource.",
    });
    return;
  }
  next();
}

