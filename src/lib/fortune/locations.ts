import type { FortuneLocation } from "./types";

export const FORTUNE_LOCATIONS: FortuneLocation[] = [
  { id: "cn-beijing", name: "北京", longitude: 116.4074, latitude: 39.9042, timezone: "Asia/Shanghai" },
  { id: "cn-shanghai", name: "上海", longitude: 121.4737, latitude: 31.2304, timezone: "Asia/Shanghai" },
  { id: "cn-guangzhou", name: "广州", longitude: 113.2644, latitude: 23.1291, timezone: "Asia/Shanghai" },
  { id: "cn-shenzhen", name: "深圳", longitude: 114.0579, latitude: 22.5431, timezone: "Asia/Shanghai" },
  { id: "cn-hangzhou", name: "杭州", longitude: 120.1551, latitude: 30.2741, timezone: "Asia/Shanghai" },
  { id: "cn-nanjing", name: "南京", longitude: 118.7969, latitude: 32.0603, timezone: "Asia/Shanghai" },
  { id: "cn-chengdu", name: "成都", longitude: 104.0665, latitude: 30.5728, timezone: "Asia/Shanghai" },
  { id: "cn-chongqing", name: "重庆", longitude: 106.5516, latitude: 29.563, timezone: "Asia/Shanghai" },
  { id: "cn-wuhan", name: "武汉", longitude: 114.3054, latitude: 30.5931, timezone: "Asia/Shanghai" },
  { id: "cn-xian", name: "西安", longitude: 108.9398, latitude: 34.3416, timezone: "Asia/Shanghai" },
  { id: "cn-tianjin", name: "天津", longitude: 117.2009, latitude: 39.0842, timezone: "Asia/Shanghai" },
  { id: "cn-suzhou", name: "苏州", longitude: 120.5853, latitude: 31.2989, timezone: "Asia/Shanghai" },
  { id: "cn-qingdao", name: "青岛", longitude: 120.3826, latitude: 36.0671, timezone: "Asia/Shanghai" },
  { id: "cn-xiamen", name: "厦门", longitude: 118.0894, latitude: 24.4798, timezone: "Asia/Shanghai" },
  { id: "cn-kunming", name: "昆明", longitude: 102.8329, latitude: 24.8801, timezone: "Asia/Shanghai" },
  { id: "cn-urumqi", name: "乌鲁木齐", longitude: 87.6168, latitude: 43.8256, timezone: "Asia/Shanghai" },
  { id: "cn-lhasa", name: "拉萨", longitude: 91.1322, latitude: 29.6604, timezone: "Asia/Shanghai" },
  { id: "cn-hongkong", name: "香港", longitude: 114.1694, latitude: 22.3193, timezone: "Asia/Hong_Kong" },
  { id: "tw-taipei", name: "台北", longitude: 121.5654, latitude: 25.033, timezone: "Asia/Taipei" },
  { id: "us-new-york", name: "纽约", longitude: -74.006, latitude: 40.7128, timezone: "America/New_York" },
  { id: "us-los-angeles", name: "洛杉矶", longitude: -118.2437, latitude: 34.0522, timezone: "America/Los_Angeles" },
  { id: "gb-london", name: "伦敦", longitude: -0.1276, latitude: 51.5072, timezone: "Europe/London" },
  { id: "jp-tokyo", name: "东京", longitude: 139.6503, latitude: 35.6762, timezone: "Asia/Tokyo" },
  { id: "sg-singapore", name: "新加坡", longitude: 103.8198, latitude: 1.3521, timezone: "Asia/Singapore" },
];

export function getFortuneLocationById(id: string): FortuneLocation {
  const location = FORTUNE_LOCATIONS.find((item) => item.id === id);
  if (!location) {
    throw new Error(`未知出生城市: ${id}`);
  }
  return location;
}
