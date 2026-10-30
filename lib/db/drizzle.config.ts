import { defineConfig } from "drizzle-kit";
import path from "path";

// Attempt to load .env from workspace root or current directory
if (typeof process.loadEnvFile === "function") {
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../.env"),
  ];
  for (const envPath of candidatePaths) {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // Continue searching
    }
  }
}

// Prefer DIRECT_URL (unpooled connection recommended for migrations by Neon), fallback to DATABASE_URL
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "";

export default defineConfig({
  schema: "./src/schema/*",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
