import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, sessionsTable, type User } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_DURATION_MS,
  generateSessionToken,
  hashPassword,
  verifyPassword,
  hashToken,
} from "../lib/auth";
import { loginRateLimiter, recordFailedLogin, resetLoginAttempts, getClientIp } from "../middlewares/rateLimiter";

const router: IRouter = Router();

function formatUserProfile(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
  };
}

/**
 * POST /api/auth/register
 * Registers a new player account and establishes a secure session.
 */
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = RegisterBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: parseResult.error.errors[0]?.message || "Invalid registration data.",
      });
      return;
    }

    const { email, password, displayName } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing account
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        error: "EMAIL_EXISTS",
        message: "An account with this email already exists.",
      });
      return;
    }

    // Securely hash password and persist user
    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(usersTable)
      .values({
        email: normalizedEmail,
        passwordHash,
        displayName: displayName.trim(),
        emailVerified: false,
      })
      .returning();

    // Issue cryptographic session token and store SHA-256 hash
    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || null;

    await db.insert(sessionsTable).values({
      id: tokenHash,
      userId: newUser.id,
      expiresAt,
      ipAddress,
      userAgent,
    });

    res.cookie(SESSION_COOKIE_NAME, rawToken, SESSION_COOKIE_OPTIONS);
    res.status(201).json({
      user: formatUserProfile(newUser),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({
      error: "SERVER_ERROR",
      message: "An unexpected error occurred during registration.",
    });
  }
});

/**
 * POST /api/auth/login
 * Validates credentials with rate limiting and issues a secure session cookie.
 */
router.post("/login", loginRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = LoginBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Please provide a valid email and password.",
      });
      return;
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (!user || !user.passwordHash) {
      recordFailedLogin(req);
      res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
      return;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      recordFailedLogin(req);
      res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
      return;
    }

    // Reset rate limiter on successful authentication
    resetLoginAttempts(req);

    // Issue new session token
    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || null;

    await db.insert(sessionsTable).values({
      id: tokenHash,
      userId: user.id,
      expiresAt,
      ipAddress,
      userAgent,
    });

    res.cookie(SESSION_COOKIE_NAME, rawToken, SESSION_COOKIE_OPTIONS);
    res.status(200).json({
      user: formatUserProfile(user),
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: "SERVER_ERROR",
      message: "An unexpected error occurred during login.",
    });
  }
});

/**
 * POST /api/auth/logout
 * Invalidates the current session token in the database and clears the session cookie.
 */
router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await db.delete(sessionsTable).where(eq(sessionsTable.id, tokenHash));
    } else if (req.session?.id) {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, req.session.id));
    }

    res.clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.status(200).json({
      success: true,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: "SERVER_ERROR",
      message: "An unexpected error occurred during logout.",
    });
  }
});

/**
 * GET /api/auth/me
 * Returns profile of currently authenticated user or 401 if unauthenticated (Guest Mode).
 */
router.get("/me", (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({
      error: "UNAUTHENTICATED",
      message: "No active session found. Running in Guest Mode.",
    });
    return;
  }

  res.status(200).json({
    user: formatUserProfile(req.user),
  });
});

export default router;
