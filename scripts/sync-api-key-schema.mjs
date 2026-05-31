import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.production" });
dotenv.config();

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();

  await client.query(`
    ALTER TABLE "ApiKey"
      ADD COLUMN IF NOT EXISTS "format" TEXT NOT NULL DEFAULT 'openai',
      ADD COLUMN IF NOT EXISTS "baseUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "models" JSONB NOT NULL DEFAULT '[]'::jsonb
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS "ApiKey_userId_provider_idx"
      ON "ApiKey" ("userId", "provider")
  `);

  const { rows } = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ApiKey'
      AND column_name IN ('format', 'baseUrl', 'models')
    ORDER BY column_name
  `);

  console.table(rows);
  console.log("ApiKey schema is ready.");
} finally {
  await client.end();
}
