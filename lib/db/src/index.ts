import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env automatically if available (Node 20.6+ / 24+ native support)
if (typeof process.loadEnvFile === "function") {
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(__dirname, "../../../.env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../.env"),
  ];
  for (const envPath of candidatePaths) {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // Continue to next path
    }
  }
}

export type AppDatabase = NodePgDatabase<typeof schema>;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
}

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(url && url.trim().length > 0);
}

export function createPool(connectionString?: string): pg.Pool {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set to connect to the database.");
  }

  // Neon PostgreSQL requires SSL in cloud environments
  const requiresSsl =
    url.includes("sslmode=require") ||
    url.includes(".neon.tech") ||
    process.env.NODE_ENV === "production";

  return new Pool({
    connectionString: url,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  });
}

let _pool: pg.Pool | null = null;
let _db: AppDatabase | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = createPool();
  }
  return _pool;
}

export function getDb(): AppDatabase {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Proxies provide backward compatibility while deferring connection until first query
export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(getPool(), prop, receiver);
  },
});

export const db = new Proxy({} as AppDatabase, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
export * from "./schema";
