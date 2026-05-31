export type ClassifiedDatabaseError = {
  code: string;
  message: string;
  status: number;
};

type ErrorWithCode = {
  code?: unknown;
};

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as ErrorWithCode).code;
  return typeof code === "string" ? code : null;
}

export function classifyDatabaseError(
  error: unknown
): ClassifiedDatabaseError | null {
  const code = getErrorCode(error);

  if (
    code === "P2021" ||
    code === "P2022" ||
    code === "42703" ||
    code === "22P02" ||
    code === "42704" ||
    code === "42883" ||
    code === "0A000"
  ) {
    return {
      code: "DATABASE_SCHEMA_OUT_OF_SYNC",
      status: 503,
      message:
        "Database schema is out of sync. Run Prisma db push or migrations on the production database, then restart the app.",
    };
  }

  return null;
}
