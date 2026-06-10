import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const { createFortuneApiErrorResponse } = jiti("./api-errors.ts");

test("createFortuneApiErrorResponse returns 503 for database schema drift", async () => {
  const response = createFortuneApiErrorResponse(
    { code: "P2021", meta: { modelName: "FortuneReading" } },
    {
      fallbackMessage: "Fortune history failed",
      fallbackCode: "FORTUNE_HISTORY_FAILED",
      logLabel: "[fortune.test]",
    }
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error:
      "Database schema is out of sync. Run Prisma db push or migrations on the production database, then restart the app.",
    code: "DATABASE_SCHEMA_OUT_OF_SYNC",
  });
});

test("createFortuneApiErrorResponse uses fallback for unknown errors", async () => {
  const response = createFortuneApiErrorResponse(new Error("network broke"), {
    fallbackMessage: "Fortune history failed",
    fallbackCode: "FORTUNE_HISTORY_FAILED",
    logLabel: "[fortune.test]",
  });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "Fortune history failed",
    code: "FORTUNE_HISTORY_FAILED",
  });
});
