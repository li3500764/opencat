import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jiti = require("../../../node_modules/.pnpm/jiti@2.6.1/node_modules/jiti")(
  import.meta.url,
  { interopDefault: true }
);
const { flattenAddressDistricts, searchFortuneAddresses } = jiti("./address.ts");

const sampleAddressTree = [
  {
    citycode: [],
    adcode: "410000",
    name: "河南省",
    center: "113.753094,34.767052",
    level: "province",
    districts: [
      {
        citycode: "0379",
        adcode: "410300",
        name: "洛阳市",
        center: "112.453895,34.619702",
        level: "city",
        districts: [
          {
            citycode: "0379",
            adcode: "410323",
            name: "新安县",
            center: "112.13246,34.728909",
            level: "district",
            districts: [],
          },
          {
            citycode: "0379",
            adcode: "410311",
            name: "洛龙区",
            center: "112.463833,34.619711",
            level: "district",
            districts: [],
          },
        ],
      },
    ],
  },
];

test("flattenAddressDistricts builds province city district paths with coordinates", () => {
  const results = flattenAddressDistricts(sampleAddressTree);
  const district = results.find((item) => item.adcode === "410323");

  assert.ok(district);
  assert.equal(district.id, "410323");
  assert.equal(district.name, "河南省 洛阳市 新安县");
  assert.equal(district.province, "河南省");
  assert.equal(district.city, "洛阳市");
  assert.equal(district.district, "新安县");
  assert.equal(district.level, "district");
  assert.equal(district.longitude, 112.13246);
  assert.equal(district.latitude, 34.728909);
  assert.equal(district.timezone, "Asia/Shanghai");
});

test("searchFortuneAddresses matches compact province city district keywords first", () => {
  const results = searchFortuneAddresses(sampleAddressTree, "河南洛阳新安", 5);

  assert.equal(results[0].adcode, "410323");
  assert.equal(results[0].name, "河南省 洛阳市 新安县");
});

test("searchFortuneAddresses ignores invalid centers and respects limit", () => {
  const results = searchFortuneAddresses(
    [
      ...sampleAddressTree,
      {
        adcode: "999999",
        name: "无效省",
        center: "not-a-coordinate",
        level: "province",
        districts: [],
      },
    ],
    "省",
    2
  );

  assert.equal(results.length, 2);
  assert.equal(results.some((item) => item.adcode === "999999"), false);
});
