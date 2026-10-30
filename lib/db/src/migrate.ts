import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import path from "path";
import { fileURLToPath } from "url";
import { createPool, isDatabaseConfigured, schema } from "./index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<{ success: boolean; message: string }> {
  const connUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connUrl) {
    return {
      success: false,
      message: "DATABASE_URL is not configured. Set DATABASE_URL in .env to apply migrations.",
    };
  }

  const pool = createPool(connUrl);
  const db = drizzle(pool, { schema });

  try {
    const migrationsFolder = path.resolve(__dirname, "../drizzle");
    await migrate(db, { migrationsFolder });
    return {
      success: true,
      message: "Database migrations applied successfully.",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to apply migrations: ${errMsg}`,
    };
  } finally {
    await pool.end();
  }
}

// Allow direct CLI execution: node dist/migrate.mjs or tsx src/migrate.ts
if (process.argv[1] && (process.argv[1].endsWith("migrate.ts") || process.argv[1].endsWith("migrate.js"))) {
  runMigrations().then((res) => {
    if (res.success) {
      console.log(`[Database Migration] ${res.message}`);
      process.exit(0);
    } else {
      console.error(`[Database Migration] ${res.message}`);
      process.exit(res.message.includes("not configured") ? 0 : 1);
    }
  });
}
