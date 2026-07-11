import { Temporal } from "@js-temporal/polyfill";

export interface ZonedLocalDateTime {
  localDateTime: string;
  timeZone: string;
  instant: string;
  offsetMinutes: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface TrueSolarTimeResult {
  originalLocalDateTime: string;
  effectiveLocalDateTime: string;
  timezoneOffsetMinutes: number;
  standardMeridianLongitude: number;
  longitudeOffsetMinutes: number;
  equationOfTimeMinutes: number;
  totalOffsetMinutes: number;
}

export function parseZonedLocalDateTime(value: string, timeZone: string): ZonedLocalDateTime {
  const plain = parsePlainLocalDateTime(value);

  try {
    const zoned = plain.toZonedDateTime(timeZone, { disambiguation: "reject" });
    return {
      localDateTime: formatPlainDateTime(plain),
      timeZone,
      instant: zoned.toInstant().toString(),
      offsetMinutes: Number(zoned.offsetNanoseconds) / 60_000_000_000,
      year: plain.year,
      month: plain.month,
      day: plain.day,
      hour: plain.hour,
      minute: plain.minute,
      second: plain.second,
    };
  } catch (error) {
    if (error instanceof RangeError && /time zone/i.test(error.message)) {
      throw new Error("时区参数无效");
    }
    throw new Error("该当地时间因夏令时切换而不存在或重复，请调整时间");
  }
}

export function parsePlainLocalDateTime(value: string) {
  try {
    return Temporal.PlainDateTime.from(value);
  } catch {
    throw new Error("日期时间格式无效");
  }
}

export function applyTrueSolarTime(input: {
  localDateTime: string;
  timeZone: string;
  longitude: number;
}): TrueSolarTimeResult {
  const parsed = parseZonedLocalDateTime(input.localDateTime, input.timeZone);
  const plain = Temporal.PlainDateTime.from(parsed.localDateTime);
  const standardMeridianLongitude = (parsed.offsetMinutes / 60) * 15;
  const longitudeOffsetMinutes = 4 * (input.longitude - standardMeridianLongitude);
  const equationOfTime = calculateEquationOfTimeMinutes(plain);
  const totalOffsetMinutes = Math.round(longitudeOffsetMinutes + equationOfTime);
  const effective = plain.add({ minutes: totalOffsetMinutes });

  return {
    originalLocalDateTime: parsed.localDateTime,
    effectiveLocalDateTime: formatPlainDateTime(effective),
    timezoneOffsetMinutes: parsed.offsetMinutes,
    standardMeridianLongitude: round2(standardMeridianLongitude),
    longitudeOffsetMinutes: round2(longitudeOffsetMinutes),
    equationOfTimeMinutes: round2(equationOfTime),
    totalOffsetMinutes,
  };
}

export function calculateEquationOfTimeMinutes(dateTime: Temporal.PlainDateTime) {
  const daysInYear = dateTime.inLeapYear ? 366 : 365;
  const fractionalHour = dateTime.hour + dateTime.minute / 60 + dateTime.second / 3600;
  const gamma = (2 * Math.PI / daysInYear) * (dateTime.dayOfYear - 1 + (fractionalHour - 12) / 24);
  return 229.18 * (
    0.000075
    + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma)
  );
}

export function addLocalMinutes(value: string, minutes: number) {
  return formatPlainDateTime(Temporal.PlainDateTime.from(value).add({ minutes }));
}

export function formatPlainDateTime(value: Temporal.PlainDateTime) {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}T${pad(value.hour)}:${pad(value.minute)}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function round2(value: number) {
  return Number(value.toFixed(2));
}
