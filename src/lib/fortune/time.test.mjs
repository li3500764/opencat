import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const {
  applyTrueSolarTime,
  parseZonedLocalDateTime,
} = jiti("./time.ts");

test("parseZonedLocalDateTime preserves the requested IANA local time", () => {
  const shanghai = parseZonedLocalDateTime("2026-07-11T12:30", "Asia/Shanghai");
  const tokyo = parseZonedLocalDateTime("2026-07-11T12:30", "Asia/Tokyo");

  assert.equal(shanghai.localDateTime, "2026-07-11T12:30");
  assert.equal(shanghai.offsetMinutes, 480);
  assert.equal(tokyo.offsetMinutes, 540);
  assert.notEqual(shanghai.instant, tokyo.instant);
});

test("parseZonedLocalDateTime rejects missing and repeated DST wall times", () => {
  assert.throws(
    () => parseZonedLocalDateTime("2026-03-08T02:30", "America/New_York"),
    /不存在或重复/
  );
  assert.throws(
    () => parseZonedLocalDateTime("2026-11-01T01:30", "America/New_York"),
    /不存在或重复/
  );
});

test("applyTrueSolarTime records longitude and equation-of-time corrections", () => {
  const corrected = applyTrueSolarTime({
    localDateTime: "1992-11-03T00:20",
    timeZone: "Asia/Shanghai",
    longitude: 87.6168,
  });

  assert.equal(corrected.originalLocalDateTime, "1992-11-03T00:20");
  assert.equal(corrected.longitudeOffsetMinutes < -120, true);
  assert.equal(Math.abs(corrected.equationOfTimeMinutes) > 10, true);
  assert.equal(corrected.totalOffsetMinutes < -100, true);
  assert.match(corrected.effectiveLocalDateTime, /^1992-11-02T22:/);
});
