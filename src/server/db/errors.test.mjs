import assert from "node:assert/strict";
import test from "node:test";

const { classifyDatabaseError } = await import("./errors.ts");

test("classifies missing database columns as schema drift", () => {
  const error = {
    code: "P2022",
    clientVersion: "7.7.0",
    meta: { modelName: "ApiKey", column: "ApiKey.models" },
  };

  assert.deepEqual(classifyDatabaseError(error), {
    code: "DATABASE_SCHEMA_OUT_OF_SYNC",
    status: 503,
    message:
      "Database schema is out of sync. Run Prisma db push or migrations on the production database, then restart the app.",
  });
});

test("does not classify unrelated database errors", () => {
  assert.equal(classifyDatabaseError({ code: "P2002" }), null);
  assert.equal(classifyDatabaseError(new Error("connection reset")), null);
});
