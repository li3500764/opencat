import { Solar } from "lunar-typescript";

export interface ZhouyiTimeInput {
  queryDateTimeLocal: string;
  question?: string;
}

export interface TrigramInfo {
  name: string;
  symbol: string;
  nature: string;
  element: string;
  number: number;
  lines: [boolean, boolean, boolean];
}

export interface HexagramInfo {
  name: string;
  symbol: string;
  kingWenNumber: number;
  upper: string;
  lower: string;
  lines: [boolean, boolean, boolean, boolean, boolean, boolean];
  lineText: string[];
}

export interface ZhouyiTimeChart {
  method: "meihua-time";
  question: string;
  inputs: {
    queryDateTimeLocal: string;
    lunar: {
      year: number;
      month: number;
      day: number;
      text: string;
    };
    yearBranch: string;
    yearBranchNumber: number;
    hourBranch: string;
    hourBranchNumber: number;
  };
  upperTrigram: TrigramInfo;
  lowerTrigram: TrigramInfo;
  primaryHexagram: HexagramInfo;
  mutualHexagram: HexagramInfo;
  changedHexagram: HexagramInfo;
  movingLine: number;
  calculationBasis: {
    ruleSet: "opencat-meihua-v1";
    library: "lunar-typescript";
    libraryVersion: "1.7.8";
    formula: string;
  };
}

const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

const TRIGRAMS: Record<number, TrigramInfo> = {
  1: { name: "乾", symbol: "☰", nature: "天", element: "金", number: 1, lines: [true, true, true] },
  2: { name: "兑", symbol: "☱", nature: "泽", element: "金", number: 2, lines: [true, true, false] },
  3: { name: "离", symbol: "☲", nature: "火", element: "火", number: 3, lines: [true, false, true] },
  4: { name: "震", symbol: "☳", nature: "雷", element: "木", number: 4, lines: [true, false, false] },
  5: { name: "巽", symbol: "☴", nature: "风", element: "木", number: 5, lines: [false, true, true] },
  6: { name: "坎", symbol: "☵", nature: "水", element: "水", number: 6, lines: [false, true, false] },
  7: { name: "艮", symbol: "☶", nature: "山", element: "土", number: 7, lines: [false, false, true] },
  8: { name: "坤", symbol: "☷", nature: "地", element: "土", number: 8, lines: [false, false, false] },
};

const HEXAGRAM_NAMES: Record<string, { name: string; number: number; symbol: string }> = {
  "乾乾": { name: "乾为天", number: 1, symbol: "䷀" },
  "坤坤": { name: "坤为地", number: 2, symbol: "䷁" },
  "坎震": { name: "水雷屯", number: 3, symbol: "䷂" },
  "艮坎": { name: "山水蒙", number: 4, symbol: "䷃" },
  "坎乾": { name: "水天需", number: 5, symbol: "䷄" },
  "乾坎": { name: "天水讼", number: 6, symbol: "䷅" },
  "坤坎": { name: "地水师", number: 7, symbol: "䷆" },
  "坎坤": { name: "水地比", number: 8, symbol: "䷇" },
  "巽乾": { name: "风天小畜", number: 9, symbol: "䷈" },
  "乾兑": { name: "天泽履", number: 10, symbol: "䷉" },
  "坤乾": { name: "地天泰", number: 11, symbol: "䷊" },
  "乾坤": { name: "天地否", number: 12, symbol: "䷋" },
  "乾离": { name: "天火同人", number: 13, symbol: "䷌" },
  "离乾": { name: "火天大有", number: 14, symbol: "䷍" },
  "坤艮": { name: "地山谦", number: 15, symbol: "䷎" },
  "震坤": { name: "雷地豫", number: 16, symbol: "䷏" },
  "兑震": { name: "泽雷随", number: 17, symbol: "䷐" },
  "艮巽": { name: "山风蛊", number: 18, symbol: "䷑" },
  "坤兑": { name: "地泽临", number: 19, symbol: "䷒" },
  "巽坤": { name: "风地观", number: 20, symbol: "䷓" },
  "离震": { name: "火雷噬嗑", number: 21, symbol: "䷔" },
  "艮离": { name: "山火贲", number: 22, symbol: "䷕" },
  "艮坤": { name: "山地剥", number: 23, symbol: "䷖" },
  "坤震": { name: "地雷复", number: 24, symbol: "䷗" },
  "乾震": { name: "天雷无妄", number: 25, symbol: "䷘" },
  "艮乾": { name: "山天大畜", number: 26, symbol: "䷙" },
  "艮震": { name: "山雷颐", number: 27, symbol: "䷚" },
  "兑巽": { name: "泽风大过", number: 28, symbol: "䷛" },
  "坎坎": { name: "坎为水", number: 29, symbol: "䷜" },
  "离离": { name: "离为火", number: 30, symbol: "䷝" },
  "兑艮": { name: "泽山咸", number: 31, symbol: "䷞" },
  "震巽": { name: "雷风恒", number: 32, symbol: "䷟" },
  "乾艮": { name: "天山遁", number: 33, symbol: "䷠" },
  "震乾": { name: "雷天大壮", number: 34, symbol: "䷡" },
  "离坤": { name: "火地晋", number: 35, symbol: "䷢" },
  "坤离": { name: "地火明夷", number: 36, symbol: "䷣" },
  "巽离": { name: "风火家人", number: 37, symbol: "䷤" },
  "离兑": { name: "火泽睽", number: 38, symbol: "䷥" },
  "坎艮": { name: "水山蹇", number: 39, symbol: "䷦" },
  "震坎": { name: "雷水解", number: 40, symbol: "䷧" },
  "艮兑": { name: "山泽损", number: 41, symbol: "䷨" },
  "巽震": { name: "风雷益", number: 42, symbol: "䷩" },
  "兑乾": { name: "泽天夬", number: 43, symbol: "䷪" },
  "乾巽": { name: "天风姤", number: 44, symbol: "䷫" },
  "兑坤": { name: "泽地萃", number: 45, symbol: "䷬" },
  "坤巽": { name: "地风升", number: 46, symbol: "䷭" },
  "兑坎": { name: "泽水困", number: 47, symbol: "䷮" },
  "坎巽": { name: "水风井", number: 48, symbol: "䷯" },
  "兑离": { name: "泽火革", number: 49, symbol: "䷰" },
  "离巽": { name: "火风鼎", number: 50, symbol: "䷱" },
  "震震": { name: "震为雷", number: 51, symbol: "䷲" },
  "艮艮": { name: "艮为山", number: 52, symbol: "䷳" },
  "巽艮": { name: "风山渐", number: 53, symbol: "䷴" },
  "震兑": { name: "雷泽归妹", number: 54, symbol: "䷵" },
  "震离": { name: "雷火丰", number: 55, symbol: "䷶" },
  "离艮": { name: "火山旅", number: 56, symbol: "䷷" },
  "巽巽": { name: "巽为风", number: 57, symbol: "䷸" },
  "兑兑": { name: "兑为泽", number: 58, symbol: "䷹" },
  "巽坎": { name: "风水涣", number: 59, symbol: "䷺" },
  "坎兑": { name: "水泽节", number: 60, symbol: "䷻" },
  "巽兑": { name: "风泽中孚", number: 61, symbol: "䷼" },
  "震艮": { name: "雷山小过", number: 62, symbol: "䷽" },
  "坎离": { name: "水火既济", number: 63, symbol: "䷾" },
  "离坎": { name: "火水未济", number: 64, symbol: "䷿" },
};

export function buildZhouyiTimeChart(input: ZhouyiTimeInput): ZhouyiTimeChart {
  const queryDate = parseLocalDateTime(input.queryDateTimeLocal);
  const solar = Solar.fromYmdHms(
    queryDate.getFullYear(),
    queryDate.getMonth() + 1,
    queryDate.getDate(),
    queryDate.getHours(),
    queryDate.getMinutes(),
    0
  );
  const lunar = solar.getLunar();
  const yearBranch = lunar.getYearZhiExact?.() || lunar.getYearZhiByLiChun?.() || lunar.getYearZhi();
  const yearBranchNumber = getBranchNumber(yearBranch);
  const hourBranch = lunar.getTimeZhi();
  const hourBranchNumber = getBranchNumber(hourBranch);
  const lunarMonth = Math.abs(lunar.getMonth());
  const lunarDay = lunar.getDay();
  const upperNumber = normalizeBaguaNumber(yearBranchNumber + lunarMonth + lunarDay);
  const lowerNumber = normalizeBaguaNumber(yearBranchNumber + lunarMonth + lunarDay + hourBranchNumber);
  const movingLine = normalizeMovingLine(yearBranchNumber + lunarMonth + lunarDay + hourBranchNumber);
  const upperTrigram = TRIGRAMS[upperNumber];
  const lowerTrigram = TRIGRAMS[lowerNumber];
  const primaryHexagram = makeHexagram(upperTrigram, lowerTrigram);
  const changedHexagram = makeHexagramFromLines(flipLine(primaryHexagram.lines, movingLine));
  const mutualHexagram = makeHexagramFromLines([
    primaryHexagram.lines[1],
    primaryHexagram.lines[2],
    primaryHexagram.lines[3],
    primaryHexagram.lines[2],
    primaryHexagram.lines[3],
    primaryHexagram.lines[4],
  ]);

  return {
    method: "meihua-time",
    question: input.question?.trim() || "未填写具体问题",
    inputs: {
      queryDateTimeLocal: formatLocalDateTime(queryDate),
      lunar: {
        year: lunar.getYear(),
        month: lunar.getMonth(),
        day: lunarDay,
        text: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      },
      yearBranch,
      yearBranchNumber,
      hourBranch,
      hourBranchNumber,
    },
    upperTrigram,
    lowerTrigram,
    primaryHexagram,
    mutualHexagram,
    changedHexagram,
    movingLine,
    calculationBasis: {
      ruleSet: "opencat-meihua-v1",
      library: "lunar-typescript",
      libraryVersion: "1.7.8",
      formula: "上卦=(年支数+农历月+农历日)%8；下卦=(年支数+农历月+农历日+时支数)%8；动爻=(年支数+农历月+农历日+时支数)%6；余数为0时取8或6。",
    },
  };
}

function makeHexagram(upper: TrigramInfo, lower: TrigramInfo): HexagramInfo {
  return makeHexagramFromTrigramNames(upper.name, lower.name, [...lower.lines, ...upper.lines] as HexagramInfo["lines"]);
}

function makeHexagramFromLines(lines: HexagramInfo["lines"]): HexagramInfo {
  const lower = findTrigramByLines(lines.slice(0, 3) as TrigramInfo["lines"]);
  const upper = findTrigramByLines(lines.slice(3, 6) as TrigramInfo["lines"]);
  return makeHexagramFromTrigramNames(upper.name, lower.name, lines);
}

function makeHexagramFromTrigramNames(upper: string, lower: string, lines: HexagramInfo["lines"]): HexagramInfo {
  const meta = HEXAGRAM_NAMES[`${upper}${lower}`];
  if (!meta) {
    throw new Error(`未知卦象组合: ${upper}${lower}`);
  }
  return {
    name: meta.name,
    symbol: meta.symbol,
    kingWenNumber: meta.number,
    upper,
    lower,
    lines,
    lineText: lines.map((isYang, index) => `${index + 1}爻${isYang ? "阳" : "阴"}`),
  };
}

function findTrigramByLines(lines: TrigramInfo["lines"]) {
  const found = Object.values(TRIGRAMS).find((trigram) =>
    trigram.lines.every((line, index) => line === lines[index])
  );
  if (!found) {
    throw new Error(`无法识别三爻: ${lines.join(",")}`);
  }
  return found;
}

function flipLine(lines: HexagramInfo["lines"], movingLine: number): HexagramInfo["lines"] {
  return lines.map((line, index) => (index === movingLine - 1 ? !line : line)) as HexagramInfo["lines"];
}

function normalizeBaguaNumber(value: number) {
  const remainder = value % 8;
  return remainder === 0 ? 8 : remainder;
}

function normalizeMovingLine(value: number) {
  const remainder = value % 6;
  return remainder === 0 ? 6 : remainder;
}

function getBranchNumber(branch: string) {
  const index = BRANCHES.indexOf(branch as (typeof BRANCHES)[number]);
  if (index < 0) throw new Error(`未知地支: ${branch}`);
  return index + 1;
}

function parseLocalDateTime(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    throw new Error("日期时间格式无效");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("日期时间格式无效");
  return date;
}

function parsePad(value: number) {
  return String(value).padStart(2, "0");
}

function formatLocalDateTime(date: Date) {
  return `${date.getFullYear()}-${parsePad(date.getMonth() + 1)}-${parsePad(date.getDate())}T${parsePad(date.getHours())}:${parsePad(date.getMinutes())}`;
}
