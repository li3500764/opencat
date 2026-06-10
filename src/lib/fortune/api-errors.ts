import { isEncryptionConfigError } from "../crypto";
import { classifyDatabaseError } from "../../server/db/errors";

type FortuneApiErrorOptions = {
  fallbackMessage: string;
  fallbackCode: string;
  logLabel: string;
};

export function createFortuneApiErrorResponse(
  error: unknown,
  options: FortuneApiErrorOptions
): Response {
  const databaseError = classifyDatabaseError(error);
  if (databaseError) {
    console.error(`${options.logLabel} Database error`, error);
    return Response.json(
      { error: databaseError.message, code: databaseError.code },
      { status: databaseError.status }
    );
  }

  if (isEncryptionConfigError(error)) {
    console.error(`${options.logLabel} Encryption config error`, error);
    return Response.json(
      {
        error:
          "Server encryption is not configured. Set ENCRYPTION_KEY to a 64-character hex string, then restart the app.",
        code: "ENCRYPTION_CONFIG_ERROR",
      },
      { status: 503 }
    );
  }

  console.error(options.logLabel, error);
  return Response.json(
    { error: options.fallbackMessage, code: options.fallbackCode },
    { status: 500 }
  );
}
