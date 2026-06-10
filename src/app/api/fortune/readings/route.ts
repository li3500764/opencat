import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { isEncryptionConfigError } from "@/lib/crypto";
import { classifyDatabaseError } from "@/server/db/errors";
import { buildBaziChart, FortuneValidationError } from "@/lib/fortune/chart";
import { getFortuneDayPillar } from "@/lib/fortune/normalize";
import { generateFortuneInterpretation } from "@/lib/fortune/reader";
import { buildTarotChart } from "@/lib/fortune/tarot";
import { buildZiweiChart } from "@/lib/fortune/ziwei";
import { buildZhouyiTimeChart } from "@/lib/fortune/zhouyi";

const fortuneLocationSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  timezone: z.string().trim().min(1),
});

const fortuneInputSchema = z.object({
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
        dayPillar: getFortuneDayPillar(reading.chart),
        createdAt: reading.createdAt,
      };
    })
  );
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
    const chart = buildBaziChart(input);
    const zhouyiChart = buildZhouyiTimeChart({
      queryDateTimeLocal: input.queryDateTimeLocal,
      question: `${input.profileName} 的当前运势与四柱综合测算`,
    });
    const tarotChart = buildTarotChart({
      profileName: input.profileName,
      birthDateTimeLocal: input.birthDateTimeLocal,
      queryDateTimeLocal: input.queryDateTimeLocal,
      question: `${input.profileName} 的当前运势与四柱、周易、塔罗综合测算`,
    });
    const ziweiChart = buildZiweiChart(input);
    const compositeChart = { bazi: chart, zhouyi: zhouyiChart, ziwei: ziweiChart, tarot: tarotChart };
    const interpretation = await generateFortuneInterpretation(session.user.id, input, chart, compositeChart);

    const reading = await db.fortuneReading.create({
      data: {
        userId: session.user.id,
        profileName: input.profileName,
        gender: input.gender,
        birthCalendar: input.birthCalendar,
        birthDateTime: new Date(input.birthDateTimeLocal),
        queryDateTime: new Date(input.queryDateTimeLocal),
        locationName: input.birthLocation.name,
        longitude: input.birthLocation.longitude,
        latitude: input.birthLocation.latitude,
        timezone: input.birthLocation.timezone,
        useTrueSolarTime: input.useTrueSolarTime,
        model: interpretation.modelId,
        chart: compositeChart as unknown as object,
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
        zhouyiChart,
        ziweiChart,
        tarotChart,
        baziChart: chart,
        compositeChart,
        interpretation: interpretation.text,
        calculationBasis: chart.calculationBasis,
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
