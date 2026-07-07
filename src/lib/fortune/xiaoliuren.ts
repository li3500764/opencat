import { Solar } from "lunar-typescript";

// ============================================================
// 小六壬排盘算法
// ============================================================
// 六神: 大安、留连、速喜、赤口、小吉、空亡
// 算法: 大安起正月(农历月) -> 月上起日(农历日) -> 日上起时(时辰)
// ============================================================

export interface XiaoliurenInput {
  profileName: string;
  queryDateTimeLocal: string;
}

export interface XiaoliurenResult {
  position: number; // 1-6
  name: string;
  meaning: string;
  keywords: string[];
  fortune: string;
  advice: string;
}

export interface XiaoliurenChart {
  method: "xiaoliuren";
  calculationBasis: {
    ruleSet: "opencat-xiaoliuren-v1";
    library: "lunar-typescript";
    libraryVersion: "1.7.8";
    lunarDate: string;
    lunarMonth: number;
    lunarDay: number;
    hourBranch: string;
    hourBranchIndex: number;
    queryDateTimeLocal: string;
  };
  monthResult: XiaoliurenResult;
  dayResult: XiaoliurenResult;
  hourResult: XiaoliurenResult;
  profileName: string;
}

const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

interface SixGodDef {
  position: number;
  name: string;
  meaning: string;
  keywords: string[];
  fortune: string;
  advice: string;
}

const SIX_GODS: SixGodDef[] = [
  {
    position: 1,
    name: "大安",
    meaning: "身不动时，属木，主平安吉祥。求谋诸事皆吉，求财得利，失物可寻，疾病安稳。",
    keywords: ["平安", "稳定", "吉祥", "静守"],
    fortune: "上吉",
    advice: "宜守不宜急，安稳前行，诸事顺遂。",
  },
  {
    position: 2,
    name: "留连",
    meaning: "人未归时，属水，主事多拖延。求谋难成，行人未归，诉讼宜缓，防口舌是非。",
    keywords: ["拖延", "纠缠", "迟滞", "暗昧"],
    fortune: "下",
    advice: "事多反复，不宜急进，耐心等待时机。",
  },
  {
    position: 3,
    name: "速喜",
    meaning: "人即至时，属火，主喜事临门。求谋顺利，求财得利，行人将至，病可痊愈。",
    keywords: ["喜庆", "快速", "顺利", "光明"],
    fortune: "上吉",
    advice: "把握时机，迅速行动，喜事将至。",
  },
  {
    position: 4,
    name: "赤口",
    meaning: "官事凶时，属金，主口舌是非。求谋多阻，官非口舌，行人有灾，诸事不利。",
    keywords: ["口舌", "是非", "争执", "凶险"],
    fortune: "凶",
    advice: "谨言慎行，避免争执，退一步海阔天空。",
  },
  {
    position: 5,
    name: "小吉",
    meaning: "人来喜时，属木，主吉庆之事。求谋可成，求财有利，婚姻和合，病可渐愈。",
    keywords: ["小利", "和合", "渐进", "温和"],
    fortune: "中吉",
    advice: "稳步前行，小事可为，大事宜缓。",
  },
  {
    position: 6,
    name: "空亡",
    meaning: "音信稀时，属土，主事落空亡。求谋不成，求财无望，行人不至，诸事不利。",
    keywords: ["空虚", "落空", "无望", "消散"],
    fortune: "凶",
    advice: "诸事不宜，静待时日，不可强求。",
  },
];

/**
 * 小六壬掐指定位
 * 从 startIndex 开始，顺数 count 步，返回落点 (1-6)
 * startIndex: 1-6 (大安=1, ..., 空亡=6)
 */
function computePosition(startIndex: number, count: number): number {
  // 从 startIndex 开始数 count 步 (包含起点)
  // 例: 从大安(1)起正月，正月=1步落在大安
  const raw = startIndex + count - 1;
  const mod = raw % 6;
  return mod === 0 ? 6 : mod;
}

function getSixGod(position: number): XiaoliurenResult {
  const god = SIX_GODS[position - 1];
  return {
    position: god.position,
    name: god.name,
    meaning: god.meaning,
    keywords: [...god.keywords],
    fortune: god.fortune,
    advice: god.advice,
  };
}

/**
 * 根据时辰地支获取时辰序号 (1-12)
 * 子时=1, 丑时=2, ..., 亥时=12
 */
function getHourBranchIndex(hourBranch: string): number {
  const idx = BRANCHES.indexOf(hourBranch as (typeof BRANCHES)[number]);
  return idx === -1 ? 1 : idx + 1;
}

export function buildXiaoliurenChart(input: XiaoliurenInput): XiaoliurenChart {
  // 解析公历时间
  const [datePart, timePart] = input.queryDateTimeLocal.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart || "12:00").split(":").map(Number);

  // 获取农历信息
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();

  const lunarMonth = lunar.getMonth();
  const lunarDay = lunar.getDay();
  const hourBranch = lunar.getTimeZhi();
  const hourBranchIndex = getHourBranchIndex(hourBranch);

  // 第一步: 大安起正月
  // 从大安(1)起，数农历月份
  const monthPosition = computePosition(1, lunarMonth);
  const monthResult = getSixGod(monthPosition);

  // 第二步: 月上起日
  // 从月份落点起，数农历日
  const dayPosition = computePosition(monthPosition, lunarDay);
  const dayResult = getSixGod(dayPosition);

  // 第三步: 日上起时
  // 从日辰落点起，数时辰序号
  const hourPosition = computePosition(dayPosition, hourBranchIndex);
  const hourResult = getSixGod(hourPosition);

  const lunarDate = `农历${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;

  return {
    method: "xiaoliuren",
    calculationBasis: {
      ruleSet: "opencat-xiaoliuren-v1",
      library: "lunar-typescript",
      libraryVersion: "1.7.8",
      lunarDate,
      lunarMonth,
      lunarDay,
      hourBranch,
      hourBranchIndex,
      queryDateTimeLocal: input.queryDateTimeLocal,
    },
    monthResult,
    dayResult,
    hourResult,
    profileName: input.profileName,
  };
}
