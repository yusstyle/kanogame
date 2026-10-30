import type { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown-ip";
}

export function loginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    if (now > record.resetAt) {
      loginAttempts.delete(ip);
    } else if (record.attempts >= MAX_ATTEMPTS) {
      const waitMinutes = Math.ceil((record.resetAt - now) / 60000);
      res.status(429).json({
        error: "TOO_MANY_REQUESTS",
        message: `Too many failed login attempts. Please try again in ${waitMinutes} minute(s).`,
      });
      return;
    }
  }

  next();
}

export function recordFailedLogin(req: Request): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record && now <= record.resetAt) {
    record.attempts += 1;
  } else {
    loginAttempts.set(ip, {
      attempts: 1,
      resetAt: now + WINDOW_MS,
    });
  }
}

export function resetLoginAttempts(req: Request): void {
  const ip = getClientIp(req);
  loginAttempts.delete(ip);
}

