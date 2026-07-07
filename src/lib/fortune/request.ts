import type { FortuneCalendar, FortuneInput } from "./types";

export type FortuneReadingRequestDraft = Omit<FortuneInput, "birthCalendar"> & {
  birthCalendar?: FortuneCalendar;
};

export function buildFortuneReadingRequestBody(input: FortuneReadingRequestDraft): FortuneInput {
  return {
    ...input,
    birthCalendar: input.birthCalendar ?? "gregorian",
  };
}
