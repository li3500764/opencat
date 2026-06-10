import { auth } from "@/lib/auth";
import { createFortuneApiErrorResponse } from "@/lib/fortune/api-errors";
import { getStoredFortuneMethod } from "@/lib/fortune/method";
import { extractFortuneCharts } from "@/lib/fortune/normalize";
import { db } from "@/server/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const reading = await db.fortuneReading.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!reading) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const { bazi, zhouyi, ziwei, tarot } = extractFortuneCharts(reading.chart);

    return Response.json({
      id: reading.id,
      profileName: reading.profileName,
      gender: reading.gender,
      birthCalendar: reading.birthCalendar,
      birthDateTime: reading.birthDateTime,
      queryDateTime: reading.queryDateTime,
      locationName: reading.locationName,
      longitude: reading.longitude,
      latitude: reading.latitude,
      timezone: reading.timezone,
      useTrueSolarTime: reading.useTrueSolarTime,
      model: reading.model,
      method: getStoredFortuneMethod(reading.chart),
      chart: reading.chart,
      baziChart: bazi,
      zhouyiChart: zhouyi,
      ziweiChart: ziwei,
      tarotChart: tarot,
      interpretation: reading.interpretation,
      usage: {
        promptTokens: reading.promptTokens,
        completionTokens: reading.completionTokens,
        totalTokens: reading.totalTokens,
        cost: reading.cost,
      },
      createdAt: reading.createdAt,
      privacyScope: "private:user",
    });
  } catch (error) {
    return createFortuneApiErrorResponse(error, {
      fallbackMessage: "Failed to load fortune reading",
      fallbackCode: "FORTUNE_READING_DETAIL_FAILED",
      logLabel: "[fortune.readings.id.GET]",
    });
  }
}
