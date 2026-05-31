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

  await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'MemoryCategory'
          AND pg_enum.enumlabel = 'workflow'
      ) THEN
        ALTER TYPE "MemoryCategory" ADD VALUE 'workflow';
      END IF;
    END
    $$;
  `);

  await client.query(`
    ALTER TABLE "Memory"
      ADD COLUMN IF NOT EXISTS "conversationId" TEXT,
      ADD COLUMN IF NOT EXISTS "imageUrl" TEXT
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS "Memory_userId_idx" ON "Memory" ("userId");
    CREATE INDEX IF NOT EXISTS "Memory_projectId_idx" ON "Memory" ("projectId");
    CREATE INDEX IF NOT EXISTS "Memory_conversationId_idx" ON "Memory" ("conversationId");
  `);

  const columns = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Memory'
      AND column_name IN ('conversationId', 'imageUrl', 'embedding')
    ORDER BY column_name
  `);

  const enumValues = await client.query(`
    SELECT enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'MemoryCategory'
    ORDER BY enumsortorder
  `);

  console.table(columns.rows);
  console.table(enumValues.rows);
  console.log("Memory schema is ready.");
} finally {
  await client.end();
}
