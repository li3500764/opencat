import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { createFortuneApiErrorResponse } from "@/lib/fortune/api-errors";
import { isEncryptionConfigError } from "@/lib/crypto";
import { classifyDatabaseError } from "@/server/db/errors";
import { buildBaziChart, FortuneValidationError } from "@/lib/fortune/chart";
import { getStoredFortuneMethod, storeFortuneChart } from "@/lib/fortune/method";
import { getFortuneChartSummary } from "@/lib/fortune/normalize";
import { FortuneInterpretationTimeoutError, generateFortuneInterpretation } from "@/lib/fortune/reader";
import { buildTarotChart } from "@/lib/fortune/tarot";
import { buildZiweiChart } from "@/lib/fortune/ziwei";
import { buildZhouyiTimeChart } from "@/lib/fortune/zhouyi";
import { buildXiaoliurenChart } from "@/lib/fortune/xiaoliuren";
import type { FortuneInput, FortuneMethod } from "@/lib/fortune/types";
import { parseZonedLocalDateTime } from "@/lib/fortune/time";

const fortuneLocationSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  timezone: z.string().trim().min(1),
});

const fortuneInputSchema = z.object({
  method: z.enum(["bazi", "ziwei", "zhouyi", "tarot", "xiaoliuren"]).default("bazi"),
  profileName: z.string().trim().min(1).max(80),
  gender: z.enum(["male", "female", "other"]),
  birthCalendar: z.literal("gregorian"),
  birthDateTimeLocal: z.string().trim().min(1),
  birthLocation: fortuneLocationSchema,
  useTrueSolarTime: z.boolean(),
  queryDateTimeLocal: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const readings = await db.fortuneReading.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        profileName: true,
        gender: true,
        birthDateTime: true,
        queryDateTime: true,
        locationName: true,
        useTrueSolarTime: true,
        model: true,
        chart: true,
        createdAt: true,
      },
    });

    return Response.json(
      readings.map((reading) => {
        return {
          id: reading.id,
          profileName: reading.profileName,
          gender: reading.gender,
          birthDateTime: reading.birthDateTime,
          queryDateTime: reading.queryDateTime,
          locationName: reading.locationName,
          useTrueSolarTime: reading.useTrueSolarTime,
          model: reading.model,
          method: getStoredFortuneMethod(reading.chart),
          summary: getFortuneChartSummary(reading.chart),
          dayPillar: getFortuneChartSummary(reading.chart),
          createdAt: reading.createdAt,
        };
      })
    );
  } catch (error) {
    return createFortuneApiErrorResponse(error, {
      fallbackMessage: "Failed to load fortune history",
      fallbackCode: "FORTUNE_HISTORY_FAILED",
      logLabel: "[fortune.readings.GET]",
    });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = fortuneInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const chart = buildSelectedFortuneChart(input);
    const interpretation = await generateFortuneInterpretation(session.user.id, input, input.method, chart);

    const reading = await db.fortuneReading.create({
      data: {
        userId: session.user.id,
        profileName: input.profileName,
        gender: input.gender,
        birthCalendar: input.birthCalendar,
        birthDateTime: new Date(
          parseZonedLocalDateTime(input.birthDateTimeLocal, input.birthLocation.timezone).instant
        ),
        queryDateTime: new Date(
          parseZonedLocalDateTime(input.queryDateTimeLocal, input.birthLocation.timezone).instant
        ),
        locationName: input.birthLocation.name,
        longitude: input.birthLocation.longitude,
        latitude: input.birthLocation.latitude,
        timezone: input.birthLocation.timezone,
        useTrueSolarTime: input.useTrueSolarTime,
        model: interpretation.modelId,
        chart: storeFortuneChart(input.method, chart),
        interpretation: interpretation.text,
        promptTokens: interpretation.promptTokens,
        completionTokens: interpretation.completionTokens,
        totalTokens: interpretation.totalTokens,
        cost: interpretation.cost,
      },
    });

    if (interpretation.totalTokens > 0) {
      await db.usageLog.create({
        data: {
          userId: session.user.id,
          model: interpretation.modelId,
          provider: interpretation.providerId,
          promptTokens: interpretation.promptTokens,
          completionTokens: interpretation.completionTokens,
          totalTokens: interpretation.totalTokens,
          cost: interpretation.cost,
        },
      });
    }

    return Response.json(
      {
        readingId: reading.id,
        chart,
        method: input.method,
        ...methodChartPayload(input.method, chart),
        interpretation: interpretation.text,
        dynamicContext: getDynamicContext(chart),
        calculationBasis: getCalculationBasis(chart),
        privacyScope: "private:user",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof FortuneValidationError) {
      return Response.json(
        { error: error.message, code: "FORTUNE_INPUT_INVALID" },
        { status: 400 }
      );
    }
    if (error instanceof FortuneInterpretationTimeoutError) {
      return Response.json(
        { error: error.message, code: "FORTUNE_AI_TIMEOUT" },
        { status: 504 }
      );
    }
    const databaseError = classifyDatabaseError(error);
    if (databaseError) {
      return Response.json(
        { error: databaseError.message, code: databaseError.code },
        { status: databaseError.status }
      );
    }
    if (isEncryptionConfigError(error)) {
      return Response.json(
        {
          error:
            "Server encryption is not configured. Set ENCRYPTION_KEY to a 64-character hex string, then restart the app.",
          code: "ENCRYPTION_CONFIG_ERROR",
        },
        { status: 503 }
      );
    }
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Fortune reading failed",
        code: "FORTUNE_READING_FAILED",
      },
      { status: 500 }
    );
  }
}

function buildSelectedFortuneChart(input: FortuneInput) {
  switch (input.method) {
    case "bazi":
      return buildBaziChart(input);
    case "ziwei":
      return buildZiweiChart(input);
    case "zhouyi":
      return buildZhouyiTimeChart({
        queryDateTimeLocal: input.queryDateTimeLocal,
        question: `${input.profileName} 的周易时间卦测算`,
      });
    case "tarot":
      return buildTarotChart({
        profileName: input.profileName,
        birthDateTimeLocal: input.birthDateTimeLocal,
        queryDateTimeLocal: input.queryDateTimeLocal,
        question: `${input.profileName} 的塔罗三张牌测算`,
      });
    case "xiaoliuren":
      return buildXiaoliurenChart({
        profileName: input.profileName,
        queryDateTimeLocal: input.queryDateTimeLocal,
      });
  }
}

function methodChartPayload(method: FortuneMethod, chart: unknown) {
  switch (method) {
    case "bazi":
      return { baziChart: chart };
    case "ziwei":
      return { ziweiChart: chart };
    case "zhouyi":
      return { zhouyiChart: chart };
    case "tarot":
      return { tarotChart: chart };
    case "xiaoliuren":
      return { xiaoliurenChart: chart };
  }
}

function getCalculationBasis(chart: unknown) {
  if (chart && typeof chart === "object" && "calculationBasis" in chart) {
    return (chart as { calculationBasis?: unknown }).calculationBasis;
  }
  return null;
}

function getDynamicContext(chart: unknown) {
  if (chart && typeof chart === "object" && "dynamicContext" in chart) {
    return (chart as { dynamicContext?: unknown }).dynamicContext || null;
  }
  return null;
}
