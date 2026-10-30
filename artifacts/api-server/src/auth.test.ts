import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { eq } from "drizzle-orm";
import app from "./app";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
  SESSION_COOKIE_NAME,
} from "./lib/auth";
import { loginRateLimiter, recordFailedLogin, resetLoginAttempts } from "./middlewares/rateLimiter";
import { db, usersTable, sessionsTable } from "@workspace/db";

describe("Milestone 16 Phase 2: Authentication Security & API Tests", () => {
  let server: http.Server;
  let baseUrl: string;

  // Clean test email prefix with unique timestamp
  const testRunId = Date.now();
  const testUser = {
    email: `pilot_${testRunId}@kanostreets.ng`,
    password: "SecureKanoPassword2026!",
    displayName: "Danjuma Ibrahim",
  };

  before(async () => {
    // Spin up ephemeral test server
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Clean up test records created during this run to keep database pristine
    try {
      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, testUser.email))
        .limit(1);

      if (existing) {
        await db.delete(usersTable).where(eq(usersTable.id, existing.id));
      }
    } catch {
      // Ignore cleanup error if running without live db
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe("1. Password Security & Cryptographic Token Generation", () => {
    it("securely hashes passwords with scrypt and unique salts", async () => {
      const pass = "SuperSecretPassword123!";
      const hash1 = await hashPassword(pass);
      const hash2 = await hashPassword(pass);

      assert.notEqual(hash1, hash2, "Distinct salts must produce distinct hashes");
      assert.match(hash1, /^[0-9a-f]{32}:[0-9a-f]{128}$/, "Hash must format as 16-byte salt:64-byte key");

      const match1 = await verifyPassword(pass, hash1);
      assert.equal(match1, true, "Valid password must verify successfully");

      const matchWrong = await verifyPassword("WrongPassword!", hash1);
      assert.equal(matchWrong, false, "Invalid password must return false");
    });

    it("generates 256-bit cryptographically secure session tokens and SHA-256 hashes", () => {
      const { rawToken, tokenHash } = generateSessionToken();

      assert.equal(rawToken.length, 64, "Raw token must have 64 hex characters (32 bytes / 256 bits)");
      assert.equal(tokenHash.length, 64, "Token hash must be SHA-256 64 hex characters");
      assert.notEqual(rawToken, tokenHash, "Raw token must never equal its hash");

      const rehashed = hashToken(rawToken);
      assert.equal(rehashed, tokenHash, "hashToken must be deterministic");
    });
  });

  describe("2. Rate Limiting Protections", () => {
    it("enforces login attempt throttling after threshold exceeded", () => {
      const mockReq = {
        headers: { "x-forwarded-for": "192.0.2.42" },
        ip: "192.0.2.42",
        socket: {},
      } as any;

      let statusCode = 200;
      let jsonBody: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (b: any) => {
              jsonBody = b;
            },
          };
        },
      } as any;

      resetLoginAttempts(mockReq);

      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(mockReq);
      }

      let nextCalled = false;
      loginRateLimiter(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, "Next must not be called when throttled");
      assert.equal(statusCode, 429, "Must return HTTP 429 Too Many Requests");
      assert.equal(jsonBody?.error, "TOO_MANY_REQUESTS");

      // Reset and verify recovery
      resetLoginAttempts(mockReq);
      nextCalled = false;
      loginRateLimiter(mockReq, mockRes, () => {
        nextCalled = true;
      });
      assert.equal(nextCalled, true, "Next must be called after reset");
    });
  });

  describe("3. Registration, Login, Session Cookie & Logout API Endpoints", () => {
    let sessionCookie: string | null = null;

    it("POST /api/auth/register succeeds and returns UserProfile with HTTP-only session cookie", async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(testUser),
      });

      assert.equal(res.status, 201, "Registration must return 201 Created");
      const body = (await res.json()) as any;

      assert.ok(body.user?.id, "User profile must have an ID");
      assert.equal(body.user.email, testUser.email.toLowerCase());
      assert.equal(body.user.displayName, testUser.displayName);
      assert.equal(body.user.passwordHash, undefined, "Password hash must NEVER be returned to client");

      // Verify Set-Cookie header
      const setCookie = res.headers.get("set-cookie");
      assert.ok(setCookie, "Must set a session cookie");
      assert.match(setCookie, new RegExp(`${SESSION_COOKIE_NAME}=`), "Cookie must match session cookie name");
      assert.match(setCookie, /HttpOnly/i, "Cookie must have HttpOnly flag");
      assert.match(setCookie, /SameSite=Lax/i, "Cookie must have SameSite=Lax flag");

      sessionCookie = setCookie.split(";")[0];
    });

    it("POST /api/auth/register rejects duplicate emails with 409 Conflict", async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(testUser),
      });

      assert.equal(res.status, 409, "Duplicate email must return 409 Conflict");
      const body = (await res.json()) as any;
      assert.equal(body.error, "EMAIL_EXISTS");
    });

    it("POST /api/auth/register rejects short passwords with 400 Bad Request", async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "shortpass@kanostreets.ng",
          password: "short",
          displayName: "Tester",
        }),
      });

      assert.equal(res.status, 400, "Password under 8 characters must return 400");
    });

    it("GET /api/auth/me returns authenticated player when valid cookie is presented", async () => {
      assert.ok(sessionCookie, "Session cookie must exist from registration");

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { cookie: sessionCookie },
      });

      assert.equal(res.status, 200, "Authenticated request must return 200");
      const body = (await res.json()) as any;
      assert.equal(body.user.email, testUser.email.toLowerCase());
      assert.equal(body.user.passwordHash, undefined);
    });

    it("GET /api/auth/me returns 401 when no session is present (Guest Mode)", async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      assert.equal(res.status, 401, "Unauthenticated request must return 401");
      const body = (await res.json()) as any;
      assert.equal(body.error, "UNAUTHENTICATED");
    });

    it("POST /api/auth/login rejects incorrect passwords with generic 401", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: testUser.email,
          password: "WrongPassword999!",
        }),
      });

      assert.equal(res.status, 401, "Invalid password must return 401");
      const body = (await res.json()) as any;
      assert.equal(body.error, "INVALID_CREDENTIALS");
    });

    it("POST /api/auth/login succeeds with valid credentials and issues new session", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      assert.equal(res.status, 200, "Valid login must return 200");
      const body = (await res.json()) as any;
      assert.equal(body.user.email, testUser.email.toLowerCase());

      const setCookie = res.headers.get("set-cookie");
      assert.ok(setCookie);
      sessionCookie = setCookie.split(";")[0];
    });

    it("POST /api/auth/logout destroys session in database and clears session cookie", async () => {
      assert.ok(sessionCookie);

      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: { cookie: sessionCookie },
      });

      assert.equal(logoutRes.status, 200, "Logout must return 200");

      // Verify Set-Cookie clears the cookie
      const setCookie = logoutRes.headers.get("set-cookie");
      assert.ok(setCookie, "Logout must set clearing cookie header");
      assert.match(setCookie, /Max-Age=0|expires=/i, "Cookie must be expired");

      // Subsequent request with the logged-out cookie must be rejected
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { cookie: sessionCookie },
      });
      assert.equal(meRes.status, 401, "Revoked session cookie must return 401");
    });
  });
});

