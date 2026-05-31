import assert from "node:assert/strict";
import test from "node:test";

const { isEncryptionConfigError } = await import("./crypto.ts");

test("identifies encryption configuration errors without exposing secrets", () => {
  const error = new Error(
    "ENCRYPTION_KEY must be a 64-character hex string. Generate one with: openssl rand -hex 32"
  );

  assert.equal(isEncryptionConfigError(error), true);
  assert.equal(isEncryptionConfigError(new Error("database unavailable")), false);
  assert.equal(isEncryptionConfigError("ENCRYPTION_KEY"), false);
});
