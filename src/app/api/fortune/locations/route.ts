import { createFortuneApiErrorResponse } from "@/lib/fortune/api-errors";
import { searchFortuneAddressFile } from "@/lib/fortune/address";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";
    const limit = Number(url.searchParams.get("limit") || 30);
    const locations = await searchFortuneAddressFile(query, limit);

    return Response.json({ locations });
  } catch (error) {
    return createFortuneApiErrorResponse(error, {
      fallbackMessage: "Failed to search fortune locations",
      fallbackCode: "FORTUNE_LOCATION_SEARCH_FAILED",
      logLabel: "[fortune.locations.GET]",
    });
  }
}
