import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const { buildFortuneReadingRequestBody } = jiti("./request.ts");

const baseDraft = {
  method: "bazi",
  profileName: "李大壮",
  gender: "male",
  birthDateTimeLocal: "1990-05-17T08:30",
  queryDateTimeLocal: "2026-07-08T00:59",
  birthLocation: {
    id: "110116",
    name: "北京市 北京城区 怀柔区",
    longitude: 116.631974,
    latitude: 40.317003,
    timezone: "Asia/Shanghai",
  },
  useTrueSolarTime: false,
  modelId: "gpt-5.5",
};

test("buildFortuneReadingRequestBody includes the gregorian birth calendar required by the API", () => {
  const body = buildFortuneReadingRequestBody(baseDraft);

  assert.equal(body.birthCalendar, "gregorian");
  assert.equal(body.profileName, "李大壮");
});

test("buildFortuneReadingRequestBody keeps an explicit gregorian calendar value", () => {
  const body = buildFortuneReadingRequestBody({
    ...baseDraft,
    birthCalendar: "gregorian",
  });

  assert.equal(body.birthCalendar, "gregorian");
});
