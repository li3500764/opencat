export type TarotOrientation = "upright" | "reversed";

export interface TarotInput {
  profileName: string;
  birthDateTimeLocal: string;
  queryDateTimeLocal: string;
  question?: string;
}

export interface TarotCardInfo {
  id: string;
  name: string;
  arcana: "major" | "minor";
  suit?: "wands" | "cups" | "swords" | "pentacles";
  rank?: string;
  keywords: string[];
  reversedKeywords: string[];
}

export interface TarotDrawnCard {
  position: {
    index: number;
    id: "past" | "present" | "future";
    name: string;
    focus: string;
  };
  card: TarotCardInfo;
  orientation: TarotOrientation;
  meaning: string[];
}

export interface TarotChart {
  method: "tarot-deterministic-draw";
  question: string;
  spread: {
    id: "past-present-future";
    name: string;
    description: string;
  };
  cards: TarotDrawnCard[];
  calculationBasis: {
    ruleSet: "opencat-tarot-v1";
    algorithm: "fnv1a64-fisher-yates-v1";
    seed: string;
    deck: "rider-waite-smith-78";
    queryDateTimeLocal: string;
  };
}

const SPREAD = {
  id: "past-present-future",
  name: "过去-现在-趋势三张牌",
  description: "首版使用三张牌展示既有影响、当前状态和短期趋势。",
} as const;

const POSITIONS: TarotDrawnCard["position"][] = [
  { index: 1, id: "past", name: "过去", focus: "既有影响、背景与惯性" },
  { index: 2, id: "present", name: "现在", focus: "当前状态、核心课题与资源" },
  { index: 3, id: "future", name: "趋势", focus: "短期发展、提醒与可调整方向" },
];

const MAJOR_ARCANA: TarotCardInfo[] = [
  card("major-00-fool", "愚者", "major", ["开始", "自由", "冒险"], ["鲁莽", "逃避", "失序"]),
  card("major-01-magician", "魔术师", "major", ["行动", "资源", "显化"], ["操控", "分散", "空转"]),
  card("major-02-high-priestess", "女祭司", "major", ["直觉", "静观", "秘密"], ["压抑", "迟疑", "信息不明"]),
  card("major-03-empress", "皇后", "major", ["滋养", "创造", "丰盛"], ["过度消耗", "依赖", "停滞"]),
  card("major-04-emperor", "皇帝", "major", ["秩序", "责任", "结构"], ["僵硬", "控制", "压力"]),
  card("major-05-hierophant", "教皇", "major", ["传统", "学习", "规范"], ["教条", "束缚", "盲从"]),
  card("major-06-lovers", "恋人", "major", ["选择", "关系", "价值"], ["摇摆", "不一致", "误选"]),
  card("major-07-chariot", "战车", "major", ["意志", "推进", "胜利"], ["失控", "冲突", "急躁"]),
  card("major-08-strength", "力量", "major", ["耐心", "勇气", "柔性掌控"], ["怯懦", "压抑", "内耗"]),
  card("major-09-hermit", "隐士", "major", ["沉淀", "寻找", "智慧"], ["孤立", "停滞", "封闭"]),
  card("major-10-wheel", "命运之轮", "major", ["变化", "周期", "机会"], ["反复", "被动", "失准"]),
  card("major-11-justice", "正义", "major", ["平衡", "因果", "判断"], ["偏见", "失衡", "回避责任"]),
  card("major-12-hanged-man", "倒吊人", "major", ["暂停", "换位", "牺牲"], ["拖延", "困住", "无谓牺牲"]),
  card("major-13-death", "死神", "major", ["结束", "转化", "清理"], ["抗拒改变", "拖泥带水", "旧事未了"]),
  card("major-14-temperance", "节制", "major", ["调和", "修复", "整合"], ["失度", "焦躁", "配合不良"]),
  card("major-15-devil", "恶魔", "major", ["欲望", "绑定", "诱惑"], ["松绑", "看清执念", "戒断"]),
  card("major-16-tower", "高塔", "major", ["突变", "破局", "真相"], ["余震", "逃避崩塌", "重建困难"]),
  card("major-17-star", "星星", "major", ["希望", "疗愈", "愿景"], ["失望", "信心不足", "理想遥远"]),
  card("major-18-moon", "月亮", "major", ["潜意识", "迷雾", "感受"], ["迷雾渐清", "焦虑减轻", "直面恐惧"]),
  card("major-19-sun", "太阳", "major", ["明朗", "成功", "生命力"], ["过度乐观", "延迟", "能量不足"]),
  card("major-20-judgement", "审判", "major", ["召唤", "复盘", "更新"], ["迟迟不决", "自责", "未完成"]),
  card("major-21-world", "世界", "major", ["完成", "整合", "阶段成果"], ["未闭环", "差一步", "格局受限"]),
];

const SUITS = [
  ["wands", "权杖", ["行动", "热情", "事业"], ["急躁", "耗竭", "方向散乱"]],
  ["cups", "圣杯", ["情感", "关系", "感受"], ["情绪化", "依附", "失望"]],
  ["swords", "宝剑", ["思考", "沟通", "决断"], ["冲突", "焦虑", "误判"]],
  ["pentacles", "星币", ["现实", "资源", "稳定"], ["迟滞", "匮乏感", "保守"]],
] as const;

const RANKS = [
  ["ace", "一", ["新机会", "萌芽"], ["起步困难", "资源未聚"]],
  ["two", "二", ["选择", "平衡"], ["犹豫", "拉扯"]],
  ["three", "三", ["协作", "初步成果"], ["配合不足", "延误"]],
  ["four", "四", ["稳定", "边界"], ["停滞", "封闭"]],
  ["five", "五", ["挑战", "调整"], ["消耗", "冲突扩大"]],
  ["six", "六", ["恢复", "支持"], ["旧模式", "依赖"]],
  ["seven", "七", ["评估", "坚持"], ["防御", "疑虑"]],
  ["eight", "八", ["推进", "练习"], ["忙乱", "重复"]],
  ["nine", "九", ["积累", "临界"], ["疲惫", "过度紧绷"]],
  ["ten", "十", ["完成", "承载"], ["负担", "过满"]],
  ["page", "侍从", ["学习", "消息"], ["稚嫩", "不成熟"]],
  ["knight", "骑士", ["行动", "追求"], ["冲动", "失衡"]],
  ["queen", "王后", ["成熟", "接纳"], ["过度保护", "情绪占主"]],
  ["king", "国王", ["掌控", "负责"], ["强势", "僵化"]],
] as const;

export const TAROT_DECK: TarotCardInfo[] = [
  ...MAJOR_ARCANA,
  ...SUITS.flatMap(([suitId, suitName, suitKeywords, suitReversed]) =>
    RANKS.map(([rankId, rankName, rankKeywords, rankReversed]) => ({
      id: `minor-${suitId}-${rankId}`,
      name: `${suitName}${rankName}`,
      arcana: "minor" as const,
      suit: suitId,
      rank: rankId,
      keywords: [...suitKeywords, ...rankKeywords],
      reversedKeywords: [...suitReversed, ...rankReversed],
    }))
  ),
];

export function buildTarotChart(input: TarotInput): TarotChart {
  const question = input.question?.trim() || "未填写具体问题";
  const seed = makeSeed([
    "opencat-tarot-v1",
    input.profileName.trim(),
    input.birthDateTimeLocal,
    input.queryDateTimeLocal,
    question,
  ]);
  const random = createDeterministicRandom(seed);
  const deck = [...TAROT_DECK];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [deck[index], deck[target]] = [deck[target], deck[index]];
  }

  return {
    method: "tarot-deterministic-draw",
    question,
    spread: SPREAD,
    cards: POSITIONS.map((position, index) => {
      const selected = deck[index];
      const orientation: TarotOrientation = random() >= 0.5 ? "upright" : "reversed";
      return {
        position,
        card: selected,
        orientation,
        meaning: orientation === "upright" ? selected.keywords : selected.reversedKeywords,
      };
    }),
    calculationBasis: {
      ruleSet: "opencat-tarot-v1",
      algorithm: "fnv1a64-fisher-yates-v1",
      seed,
      deck: "rider-waite-smith-78",
      queryDateTimeLocal: input.queryDateTimeLocal,
    },
  };
}

function card(
  id: string,
  name: string,
  arcana: TarotCardInfo["arcana"],
  keywords: string[],
  reversedKeywords: string[]
): TarotCardInfo {
  return { id, name, arcana, keywords, reversedKeywords };
}

function makeSeed(parts: string[]) {
  const hash = fnv1a64(parts.join("\u001f"));
  return hash.toString(16).padStart(16, "0").slice(-16);
}

function fnv1a64(value: string) {
  let hash = BigInt("0xcbf29ce484222325");
  const prime = BigInt("0x100000001b3");
  const modulus = BigInt("0xffffffffffffffff");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & modulus;
  }
  return hash;
}

function createDeterministicRandom(seedHex: string) {
  let state = BigInt(`0x${seedHex}`) || BigInt("0x9e3779b97f4a7c15");
  return () => {
    state ^= state << BigInt(13);
    state ^= state >> BigInt(7);
    state ^= state << BigInt(17);
    const value = Number(state & BigInt("0x1fffffffffffff"));
    return value / Number(BigInt("0x20000000000000"));
  };
}
