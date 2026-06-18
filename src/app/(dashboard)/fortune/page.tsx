"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Compass,
  History,
  Loader2,
  MessageCircle,
  MapPin,
  RefreshCw,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Share2,
} from "lucide-react";
import { ShareModal } from "@/components/fortune/share-modal";
import { ModelSelector } from "@/components/chat/model-selector";
import { FORTUNE_LOCATIONS } from "@/lib/fortune/locations";
import { extractFortuneCharts } from "@/lib/fortune/normalize";
import type { BaziChart, FortuneGender, FortuneLocation, FortuneMethod } from "@/lib/fortune/types";
import type { TarotChart } from "@/lib/fortune/tarot";
import type { ZiweiChart } from "@/lib/fortune/ziwei";
import type { ZhouyiTimeChart } from "@/lib/fortune/zhouyi";

interface FortuneReadingListItem {
  id: string;
  profileName: string;
  gender: string;
  birthDateTime: string;
  queryDateTime: string;
  locationName: string;
  useTrueSolarTime: boolean;
  model: string;
  dayPillar: string;
  method?: FortuneMethod;
  summary?: string;
  createdAt: string;
}

interface FortuneReadingDetail {
  id: string;
  profileName: string;
  gender: FortuneGender;
  birthCalendar: "gregorian";
  birthDateTime: string;
  queryDateTime: string;
  locationName: string;
  longitude: number;
  latitude: number;
  timezone: string;
  useTrueSolarTime: boolean;
  chart: unknown;
  method?: FortuneMethod;
  baziChart?: BaziChart | null;
  zhouyiChart?: ZhouyiTimeChart;
  ziweiChart?: ZiweiChart;
  tarotChart?: TarotChart;
  interpretation: string;
  model: string;
  createdAt: string;
}

interface FortuneResponse {
  readingId: string;
  method: FortuneMethod;
  chart: unknown;
  baziChart?: BaziChart;
  zhouyiChart?: ZhouyiTimeChart;
  ziweiChart?: ZiweiChart;
  tarotChart?: TarotChart;
  interpretation: string;
}

interface FortuneConsultMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  createdAt: string;
}

interface FortuneAddressResult extends FortuneLocation {
  id: string;
  adcode: string;
  province?: string;
  city?: string;
  district?: string;
  level: "province" | "city" | "district" | "street";
}

const DEFAULT_LOCATION = FORTUNE_LOCATIONS.find((location) => location.id === "cn-beijing") || FORTUNE_LOCATIONS[0];
const FORTUNE_MODEL_STORAGE_KEY = "opencat_fortune_last_model";
const FORTUNE_METHODS: { value: FortuneMethod; label: string; description: string }[] = [
  { value: "bazi", label: "四柱八字", description: "按四柱、十神、五行、大运流年解读" },
  { value: "ziwei", label: "紫微斗数", description: "按十二宫、命身宫、星曜结构解读" },
  { value: "zhouyi", label: "周易时间卦", description: "按本卦、动爻、互卦、变卦解读" },
  { value: "tarot", label: "塔罗牌阵", description: "按三张牌牌位与正逆位解读" },
];

function nowLocalInputValue() {
  const date = new Date();
  date.setSeconds(0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeLocalInputValue(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[T\s](\d{2}:\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}T${match[4]}`;
  }
  return trimmed.slice(0, 16).replace(" ", "T");
}

function elementLabel(element: string) {
  const labels: Record<string, string> = {
    wood: "木",
    fire: "火",
    earth: "土",
    metal: "金",
    water: "水",
  };
  return labels[element] || element;
}

function methodLabel(method?: FortuneMethod) {
  return FORTUNE_METHODS.find((item) => item.value === method)?.label || "四柱八字";
}

function readChartsFromPayload(payload: { chart?: unknown; baziChart?: BaziChart | null; zhouyiChart?: ZhouyiTimeChart; ziweiChart?: ZiweiChart; tarotChart?: TarotChart }) {
  if (payload.baziChart) {
    return {
      bazi: payload.baziChart,
      zhouyi: payload.zhouyiChart,
      ziwei: payload.ziweiChart,
      tarot: payload.tarotChart,
    };
  }
  const extracted = extractFortuneCharts(payload.chart);
  return {
    bazi: extracted.bazi,
    zhouyi: payload.zhouyiChart || extracted.zhouyi,
    ziwei: payload.ziweiChart || extracted.ziwei,
    tarot: payload.tarotChart || extracted.tarot,
  };
}

function restoredBirthDateTimeForForm(detail: FortuneReadingDetail, charts: ReturnType<typeof readChartsFromPayload>) {
  return (
    charts.bazi?.calculationBasis.originalBirthDateTimeLocal ||
    charts.ziwei?.calculationBasis.originalBirthDateTimeLocal ||
    detail.birthDateTime
  );
}

function restoredQueryDateTimeForForm(detail: FortuneReadingDetail, charts: ReturnType<typeof readChartsFromPayload>) {
  return (
    charts.bazi?.calculationBasis.queryDateTimeLocal ||
    charts.zhouyi?.inputs.queryDateTimeLocal ||
    charts.tarot?.calculationBasis.queryDateTimeLocal ||
    detail.queryDateTime
  );
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      if (res.status === 524) return "模型解读超时，请换用更快的模型或稍后重试";
      if (res.status === 504) return "模型解读超时，请换用更快的模型或稍后重试";
      return `${fallback}（服务器返回了非 JSON 响应，HTTP ${res.status}）`;
    }
    const data = (await res.json()) as { error?: unknown; code?: unknown };
    const message = typeof data.error === "string" ? data.error : fallback;
    const code = typeof data.code === "string" ? data.code : "";
    return code ? `${message} (${code})` : message;
  } catch {
    return fallback;
  }
}

export default function FortunePage() {
  const [method, setMethod] = useState<FortuneMethod>("bazi");
  const [profileName, setProfileName] = useState("");
  const [gender, setGender] = useState<FortuneGender>("male");
  const [birthDateTimeLocal, setBirthDateTimeLocal] = useState("1990-05-17T08:30");
  const [queryDateTimeLocal, setQueryDateTimeLocal] = useState(nowLocalInputValue());
  const [selectedAddressLocation, setSelectedAddressLocation] = useState<FortuneLocation>(DEFAULT_LOCATION);
  const [locationQuery, setLocationQuery] = useState(DEFAULT_LOCATION.name);
  const [locationResults, setLocationResults] = useState<FortuneAddressResult[]>([]);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [customLocation, setCustomLocation] = useState<FortuneLocation>({
    name: "",
    longitude: 116.4074,
    latitude: 39.9042,
    timezone: "Asia/Shanghai",
  });
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [useTrueSolarTime, setUseTrueSolarTime] = useState(false);
  const [modelId, setModelId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [history, setHistory] = useState<FortuneReadingListItem[]>([]);
  const [activeReading, setActiveReading] = useState<FortuneReadingDetail | null>(null);
  const [chart, setChart] = useState<BaziChart | null>(null);
  const [zhouyiChart, setZhouyiChart] = useState<ZhouyiTimeChart | null>(null);
  const [ziweiChart, setZiweiChart] = useState<ZiweiChart | null>(null);
  const [tarotChart, setTarotChart] = useState<TarotChart | null>(null);
  const [interpretation, setInterpretation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currentReadingId, setCurrentReadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chart" | "consult">("chart");
  const [consultMessages, setConsultMessages] = useState<FortuneConsultMessage[]>([]);
  const [consultInput, setConsultInput] = useState("");
  const [isLoadingConsult, setIsLoadingConsult] = useState(false);
  const [isAskingMaster, setIsAskingMaster] = useState(false);
  const [deletingReadingId, setDeletingReadingId] = useState<string | null>(null);
  const [isClearingConsult, setIsClearingConsult] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const hasResult = Boolean(chart || zhouyiChart || ziweiChart || tarotChart);

  const birthLocation = useCustomLocation ? customLocation : selectedAddressLocation;

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/fortune/readings", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "加载历史记录失败"));
      }
      setHistory(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载历史记录失败");
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    try {
      const savedModelId = localStorage.getItem(FORTUNE_MODEL_STORAGE_KEY);
      if (savedModelId) setModelId(savedModelId);
    } catch {
      // localStorage may be unavailable in private or restricted browser modes.
    }
  }, []);

  useEffect(() => {
    if (useCustomLocation) return;

    const controller = new AbortController();
    const query = locationQuery.trim();
    const timer = window.setTimeout(async () => {
      setIsSearchingLocations(true);
      setLocationSearchError(null);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        params.set("limit", "20");
        const res = await fetch(`/api/fortune/locations?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(await readErrorMessage(res, "搜索出生地区失败"));
        }
        const data = (await res.json()) as { locations?: FortuneAddressResult[] };
        setLocationResults(data.locations || []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLocationResults([]);
        setLocationSearchError(err instanceof Error ? err.message : "搜索出生地区失败");
      } finally {
        if (!controller.signal.aborted) setIsSearchingLocations(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locationQuery, useCustomLocation]);

  const handleModelChange = useCallback((nextModelId: string) => {
    setModelId(nextModelId);
    try {
      if (nextModelId) {
        localStorage.setItem(FORTUNE_MODEL_STORAGE_KEY, nextModelId);
      }
    } catch {
      // Ignore persistence failures; the selected model still works for this session.
    }
  }, []);

  const fetchConsult = useCallback(async (readingId: string) => {
    setIsLoadingConsult(true);
    try {
      const res = await fetch(`/api/fortune/readings/${readingId}/consult`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "读取咨询记录失败"));
      }
      const data = (await res.json()) as { messages?: FortuneConsultMessage[] };
      setConsultMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取咨询记录失败");
    } finally {
      setIsLoadingConsult(false);
    }
  }, []);

  const submitReading = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/fortune/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          profileName,
          gender,
          birthCalendar: "gregorian",
          birthDateTimeLocal,
          birthLocation,
          useTrueSolarTime,
          queryDateTimeLocal,
          modelId,
        }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "生成测算失败"));
      }
      const data = await res.json();
      const result = data as FortuneResponse;
      const charts = readChartsFromPayload(result);
      if (!charts.bazi && !charts.ziwei && !charts.zhouyi && !charts.tarot) throw new Error("测算数据格式无效");
      setChart(charts.bazi);
      setZhouyiChart(charts.zhouyi || null);
      setZiweiChart(charts.ziwei || null);
      setTarotChart(charts.tarot || null);
      setInterpretation(result.interpretation);
      setActiveReading(null);
      setCurrentReadingId(result.readingId);
      setConsultMessages([]);
      setActiveTab("chart");
      await fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成测算失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadReading = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/fortune/readings/${id}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "读取历史测算失败"));
      }
      const detail = (await res.json()) as FortuneReadingDetail;
      const charts = readChartsFromPayload(detail);
      if (!charts.bazi && !charts.ziwei && !charts.zhouyi && !charts.tarot) throw new Error("历史测算数据格式无效");
      const restoredLocation: FortuneLocation = {
        id: detail.id,
        name: detail.locationName,
        longitude: detail.longitude,
        latitude: detail.latitude,
        timezone: detail.timezone,
      };
      setMethod(detail.method || "bazi");
      setProfileName(detail.profileName);
      setGender(detail.gender);
      setBirthDateTimeLocal(toDateTimeLocalInputValue(restoredBirthDateTimeForForm(detail, charts)));
      setQueryDateTimeLocal(toDateTimeLocalInputValue(restoredQueryDateTimeForForm(detail, charts)));
      setSelectedAddressLocation(restoredLocation);
      setLocationQuery(detail.locationName);
      setCustomLocation(restoredLocation);
      setUseCustomLocation(false);
      setUseTrueSolarTime(detail.useTrueSolarTime);
      setModelId(detail.model);
      setActiveReading(detail);
      setChart(charts.bazi);
      setZhouyiChart(charts.zhouyi || null);
      setZiweiChart(charts.ziwei || null);
      setTarotChart(charts.tarot || null);
      setInterpretation(detail.interpretation);
      setCurrentReadingId(detail.id);
      setActiveTab("chart");
      await fetchConsult(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取历史测算失败");
    }
  };

  const deleteReading = async (id: string) => {
    if (deletingReadingId) return;
    if (!confirm("确定要删除这条历史测算吗？排盘结果、AI 解读和大师对话都会删除。")) return;

    setError(null);
    setDeletingReadingId(id);
    try {
      const res = await fetch(`/api/fortune/readings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "删除历史测算失败"));
      }
      setHistory((items) => items.filter((item) => item.id !== id));
      if (currentReadingId === id) {
        setActiveReading(null);
        setCurrentReadingId(null);
        setChart(null);
        setZhouyiChart(null);
        setZiweiChart(null);
        setTarotChart(null);
        setInterpretation("");
        setConsultMessages([]);
        setConsultInput("");
        setActiveTab("chart");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除历史测算失败");
    } finally {
      setDeletingReadingId(null);
    }
  };

  const clearConsult = async () => {
    if (!currentReadingId || isClearingConsult || isAskingMaster || consultMessages.length === 0) return;
    if (!confirm("确定清空当前这条测算的大师对话吗？排盘结果和 AI 解读会保留。")) return;

    setError(null);
    setIsClearingConsult(true);
    try {
      const res = await fetch(`/api/fortune/readings/${currentReadingId}/consult`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "清空大师对话失败"));
      }
      setConsultMessages([]);
      setConsultInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空大师对话失败");
    } finally {
      setIsClearingConsult(false);
    }
  };

  const askMaster = async () => {
    if (!currentReadingId || !consultInput.trim() || !modelId || isAskingMaster) return;
    const userMessage: FortuneConsultMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: consultInput.trim(),
      createdAt: new Date().toISOString(),
    };
    setConsultInput("");
    setConsultMessages((messages) => [...messages, userMessage]);
    setIsAskingMaster(true);
    setError(null);
    try {
      const res = await fetch(`/api/fortune/readings/${currentReadingId}/consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          modelId,
        }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "咨询大师失败"));
      }
      const data = (await res.json()) as { message: FortuneConsultMessage };
      setConsultMessages((messages) =>
        messages.filter((message) => message.id !== userMessage.id).concat(userMessage, data.message)
      );
    } catch (err) {
      setConsultMessages((messages) => messages.filter((message) => message.id !== userMessage.id));
      setError(err instanceof Error ? err.message : "咨询大师失败");
    } finally {
      setIsAskingMaster(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background xl:h-[calc(100vh-88px)] xl:overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:gap-5 sm:px-5 sm:py-6 xl:min-h-0 xl:flex-1">
        <header className="flex shrink-0 flex-col gap-3 border-b border-border pb-4 sm:pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-accent">
              <Compass className="h-3.5 w-3.5" />
              术数测算 · 程序排盘
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">算命</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              选择一种测算方法，系统先用代码生成该体系的基础盘面，再交给模型解读。AI 不跨体系混算。
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <ShieldCheck className="h-4 w-4" />
            历史记录仅当前登录账号可见
          </div>
        </header>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[390px_1fr]">
          <section className="space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">输入信息</h2>
                  <p className="text-xs text-muted">单一体系独立测算</p>
                </div>
                <ModelSelector value={modelId} onChange={handleModelChange} />
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-medium text-muted">
                  测算方法
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value as FortuneMethod)}
                    className="mt-1 w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
                  >
                    {FORTUNE_METHODS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] leading-5 text-muted">
                    {FORTUNE_METHODS.find((item) => item.value === method)?.description}
                  </span>
                </label>

                <label className="block text-xs font-medium text-muted">
                  姓名
                  <input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
                    placeholder="请输入姓名"
                  />
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["male", "男"],
                    ["female", "女"],
                    ["other", "其他"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setGender(value as FortuneGender)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        gender === value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="block text-xs font-medium text-muted">
                  公历出生时间
                  <input
                    type="datetime-local"
                    value={birthDateTimeLocal}
                    onChange={(event) => setBirthDateTimeLocal(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
                  />
                </label>

                <label className="block text-xs font-medium text-muted">
                  起盘/测算时间
                  <input
                    type="datetime-local"
                    value={queryDateTimeLocal}
                    onChange={(event) => setQueryDateTimeLocal(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
                  />
                </label>

                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">出生地区</span>
                    <button
                      onClick={() => setUseCustomLocation((value) => !value)}
                      className="text-xs font-medium text-accent hover:text-accent-hover"
                    >
                      {useCustomLocation ? "使用城市库" : "手动经纬度"}
                    </button>
                  </div>

                  {useCustomLocation ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={customLocation.name}
                        onChange={(event) => setCustomLocation({ ...customLocation, name: event.target.value })}
                        className="col-span-2 rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/60"
                        placeholder="地区名称"
                      />
                      <input
                        type="number"
                        value={customLocation.longitude}
                        onChange={(event) => setCustomLocation({ ...customLocation, longitude: Number(event.target.value) })}
                        className="rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/60"
                        placeholder="经度"
                      />
                      <input
                        type="number"
                        value={customLocation.latitude}
                        onChange={(event) => setCustomLocation({ ...customLocation, latitude: Number(event.target.value) })}
                        className="rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/60"
                        placeholder="纬度"
                      />
                      <input
                        value={customLocation.timezone}
                        onChange={(event) => setCustomLocation({ ...customLocation, timezone: event.target.value })}
                        className="col-span-2 rounded-lg border border-border bg-input-bg px-3 py-2 text-sm outline-none focus:border-accent/60"
                        placeholder="Asia/Shanghai"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                        <input
                          value={locationQuery}
                          onChange={(event) => setLocationQuery(event.target.value)}
                          className="w-full rounded-lg border border-border bg-input-bg py-2 pl-9 pr-9 text-sm text-foreground outline-none focus:border-accent/60"
                          placeholder="搜索省 / 市 / 区，例如 河南洛阳新安"
                        />
                        {isSearchingLocations && (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
                        )}
                      </div>

                      {locationSearchError && <p className="text-[11px] leading-5 text-danger">{locationSearchError}</p>}

                      <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-background">
                        {locationResults.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-muted">
                            {isSearchingLocations ? "正在搜索地区..." : "没有匹配地区，可切换手动经纬度"}
                          </p>
                        ) : (
                          locationResults.map((location) => {
                            const isSelected = selectedAddressLocation.id === location.id;
                            return (
                              <button
                                key={location.id}
                                type="button"
                                onClick={() => {
                                  setSelectedAddressLocation(location);
                                  setLocationQuery(location.name);
                                }}
                                className={`block w-full border-b border-border px-3 py-2 text-left last:border-b-0 ${
                                  isSelected ? "bg-accent/10" : "hover:bg-[var(--sidebar-hover)]"
                                }`}
                              >
                                <span className="block text-sm font-medium text-foreground">{location.name}</span>
                                <span className="mt-0.5 block text-[11px] text-muted">
                                  {location.level} · {location.longitude.toFixed(4)}, {location.latitude.toFixed(4)} · {location.timezone}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="rounded-lg bg-[var(--sidebar-hover)] px-3 py-2 text-[11px] leading-5 text-muted">
                        已选：{selectedAddressLocation.name} · {selectedAddressLocation.longitude.toFixed(4)},{" "}
                        {selectedAddressLocation.latitude.toFixed(4)} · {selectedAddressLocation.timezone}
                      </div>
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <input
                    type="checkbox"
                    checked={useTrueSolarTime}
                    onChange={(event) => setUseTrueSolarTime(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">启用真太阳时修正</span>
                    <span className="text-xs leading-5 text-muted">
                      根据出生地经度修正时间，可能影响时柱或临界日柱。默认关闭并按标准时间排盘。
                    </span>
                  </span>
                </label>

                <button
                  onClick={submitReading}
                  disabled={isSubmitting || !profileName.trim() || !modelId}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isSubmitting ? "正在测算并解读..." : "生成测算"}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <History className="h-4 w-4 text-muted" />
                  历史记录
                </h2>
                <button onClick={fetchHistory} className="text-muted hover:text-foreground">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              {isLoadingHistory ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted" />
                </div>
              ) : history.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">暂无历史测算</p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1 xl:max-h-none xl:overflow-visible xl:pr-0">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-stretch rounded-lg border border-border transition-colors hover:bg-[var(--sidebar-hover)]"
                    >
                      <button
                        onClick={() => loadReading(item.id)}
                        className="min-w-0 flex-1 px-3 py-2 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{item.profileName}</span>
                          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">{methodLabel(item.method)}</span>
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-muted">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {item.locationName} · {item.summary || item.dayPillar || "摘要"} · {formatDisplayDate(item.createdAt)}
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteReading(item.id)}
                        disabled={deletingReadingId === item.id}
                        className="flex w-10 shrink-0 items-center justify-center border-l border-border text-muted opacity-100 transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 xl:opacity-0 xl:group-hover:opacity-100"
                        title="删除历史测算"
                      >
                        {deletingReadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm xl:min-h-0">
            {!hasResult ? (
              <div className="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-background to-accent/5 px-6 py-10 text-center sm:min-h-[420px] xl:h-full xl:min-h-[620px]">
                {/* Background effects */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-accent/20 blur-[80px]" />
                
                <div className="relative z-10 flex flex-col items-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                    <Sparkles className="h-10 w-10 animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-accent to-amber-300">
                    赛博玄学引擎 OpenCat Astro
                  </h2>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
                    填写左侧信息，召唤专属你的赛博算命师。<br/>用代码解构命运，用 AI 破译灵魂。
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-col xl:h-full">
                <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-start lg:justify-between xl:p-5 xl:pb-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">Programmatic Chart</p>
                    <h2 className="mt-1 text-xl font-bold text-foreground">
                      {chart
                        ? `${chart.profileName} · 日主 ${chart.pillars.day.stem}`
                        : ziweiChart
                          ? `${ziweiChart.profileName} · ${methodLabel("ziwei")}`
                          : methodLabel(zhouyiChart ? "zhouyi" : "tarot")}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {activeReading ? `历史记录 · ${formatDisplayDate(activeReading.createdAt)}` : "最新生成"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {chart && (
                      <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
                        {chart.calculationBasis.timeBasis === "trueSolar" ? "真太阳时" : "标准时间"} · {chart.calculationBasis.locationName}
                      </div>
                    )}
                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      生成分享卡片
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto border-b border-border px-4 pt-2 xl:px-5 xl:pt-3">
                  {[
                    ["chart", "排盘结果", ScrollText],
                    ["consult", "咨询大师", MessageCircle],
                  ].map(([value, label, Icon]) => {
                    const TabIcon = Icon as typeof ScrollText;
                    return (
                      <button
                        key={value as string}
                        onClick={() => setActiveTab(value as "chart" | "consult")}
                        className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
                          activeTab === value
                            ? "border-accent text-accent"
                            : "border-transparent text-muted hover:text-foreground"
                        }`}
                      >
                        <TabIcon className="h-4 w-4" />
                        {label as string}
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:p-5">
                  {activeTab === "consult" ? (
                    <div className="flex flex-col gap-4 xl:min-h-full">
                      <div className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          咨询只基于当前这条{methodLabel(activeReading?.method || method)}测算和程序盘面，不进入普通聊天记忆，也不跨体系混算。
                        </span>
                        <button
                          type="button"
                          onClick={() => void clearConsult()}
                          disabled={!currentReadingId || consultMessages.length === 0 || isClearingConsult || isAskingMaster}
                          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-amber-500/20 bg-card px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isClearingConsult ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          清空对话
                        </button>
                      </div>

                      <div className="min-h-[240px] flex-1 space-y-3 rounded-lg border border-border bg-background-secondary p-3 sm:min-h-[320px] sm:p-4">
                        {isLoadingConsult ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted" />
                          </div>
                        ) : consultMessages.length === 0 ? (
                          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                            <MessageCircle className="mb-3 h-8 w-8 text-muted" />
                            <p className="text-sm font-medium text-foreground">可以开始问大师了</p>
                            <p className="mt-1 max-w-sm text-xs leading-5 text-muted">
                              例如：接下来三年事业要注意什么？这段关系应该怎么看？当前卦象最提醒我的是什么？
                            </p>
                          </div>
                        ) : (
                          consultMessages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-6 sm:max-w-[82%] ${
                                  message.role === "user"
                                    ? "bg-foreground text-background"
                                    : "border border-border bg-card text-foreground"
                                }`}
                              >
                                <div className="whitespace-pre-wrap break-words">{message.content}</div>
                              </div>
                            </div>
                          ))
                        )}
                        {isAskingMaster && (
                          <div className="flex justify-start">
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              大师正在看盘...
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-border bg-card p-3">
                        <textarea
                          value={consultInput}
                          onChange={(event) => setConsultInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                              event.preventDefault();
                              void askMaster();
                            }
                          }}
                          className="min-h-20 w-full resize-none rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
                          placeholder={currentReadingId ? "基于当前排盘继续提问..." : "请先生成或打开一条测算"}
                          disabled={!currentReadingId || isAskingMaster}
                        />
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] text-muted">Cmd/Ctrl + Enter 发送</span>
                          <button
                            onClick={askMaster}
                            disabled={!currentReadingId || !consultInput.trim() || !modelId || isAskingMaster}
                            className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isAskingMaster ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            发送
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 sm:space-y-5">
                {chart && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {(["year", "month", "day", "hour"] as const).map((key) => {
                        const pillar = chart.pillars[key];
                        const title = { year: "年柱", month: "月柱", day: "日柱", hour: "时柱" }[key];
                        return (
                          <div key={key} className="rounded-lg border border-border bg-background-secondary p-4">
                            <p className="text-xs text-muted">{title}</p>
                            <div className="mt-2 text-2xl font-black tracking-wide text-foreground">{pillar.stemBranch}</div>
                            <p className="mt-1 text-xs text-muted">
                              {pillar.tenGod} · {pillar.naYin}
                            </p>
                            <p className="mt-2 text-[11px] text-muted">
                              藏干：{pillar.hiddenStems.map((stem) => `${stem.stem}${stem.tenGod}`).join(" / ")}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border border-border p-4">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">五行分布</h3>
                        {(["wood", "fire", "earth", "metal", "water"] as const).map((element) => (
                          <div key={element} className="mb-2 last:mb-0">
                            <div className="mb-1 flex justify-between text-xs text-muted">
                              <span>{elementLabel(element)}</span>
                              <span>{chart.fiveElementBalance[element]}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-border">
                              <div
                                className="h-full rounded-full bg-accent"
                                style={{ width: `${(chart.fiveElementBalance[element] / chart.fiveElementBalance.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg border border-border p-4">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">格局与旺衰</h3>
                        <p className="text-sm font-semibold text-foreground">{chart.pattern.name}</p>
                        <p className="mt-2 text-xs leading-5 text-muted">{chart.dayMasterStrength.explanation}</p>
                        <p className="mt-2 text-xs text-muted">建议元素：{chart.pattern.usefulElements.map(elementLabel).join("、")}</p>
                      </div>

                      <div className="rounded-lg border border-border p-4">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">节气口径</h3>
                        <p className="text-xs text-muted">上一节气：{chart.solarTerms.previous.name}</p>
                        <p className="mt-1 text-xs text-muted">下一节气：{chart.solarTerms.next.name}</p>
                        <p className="mt-1 text-xs text-muted">月令边界：{chart.solarTerms.monthBoundaryUsed.name}</p>
                        <p className="mt-3 text-[11px] leading-5 text-muted">
                          修正时间：{chart.calculationBasis.effectiveBirthDateTimeLocal}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <CalendarClock className="h-4 w-4 text-muted" />
                        大运与流年
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-xs">
                          <thead className="text-muted">
                            <tr className="border-b border-border">
                              <th className="py-2">序</th>
                              <th>大运</th>
                              <th>年龄</th>
                              <th>年份</th>
                              <th>方向</th>
                              <th>十神</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chart.luckCycles.slice(0, 8).map((cycle) => (
                              <tr key={cycle.index} className="border-b border-border/60 last:border-0">
                                <td className="py-2 text-muted">{cycle.index}</td>
                                <td className="font-semibold text-foreground">{cycle.pillar.stemBranch}</td>
                                <td className="text-muted">{cycle.startAge}-{cycle.endAge}</td>
                                <td className="text-muted">{cycle.startYear}-{cycle.endYear}</td>
                                <td className="text-muted">{cycle.direction === "forward" ? "顺行" : "逆行"}</td>
                                <td className="text-muted">{cycle.pillar.tenGod}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 rounded-lg bg-background-secondary px-3 py-2 text-xs text-muted">
                        当前流年：{chart.annualFortune.year} · {chart.annualFortune.pillar.stemBranch} · {chart.annualFortune.relationToDayMaster}
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-lg border border-border p-4">
                        <h3 className="mb-2 text-sm font-semibold text-foreground">合冲刑害破</h3>
                        <div className="flex flex-wrap gap-2">
                          {(chart.relations.length ? chart.relations : ["无明显合冲"]).map((item) => (
                            <span key={item} className="rounded bg-background-secondary px-2 py-1 text-xs text-muted">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-4">
                        <h3 className="mb-2 text-sm font-semibold text-foreground">神煞</h3>
                        <div className="flex flex-wrap gap-2">
                          {chart.shenSha.map((item) => (
                            <span key={item} className="rounded bg-accent/10 px-2 py-1 text-xs text-accent">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {ziweiChart && (
                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">紫微斗数</h3>
                        <p className="mt-1 text-xs text-muted">
                          {ziweiChart.calculationBasis.ruleSet} · {ziweiChart.lunarDate} · {ziweiChart.time} {ziweiChart.timeRange}
                        </p>
                      </div>
                      <span className="rounded bg-background-secondary px-2 py-1 text-xs text-muted">
                        {ziweiChart.fiveElementsClass} · 命主{ziweiChart.soul} · 身主{ziweiChart.body}
                      </span>
                    </div>

                    <div className="mb-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-border bg-background-secondary p-3">
                        <p className="text-xs text-muted">命宫</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{ziweiChart.earthlyBranchOfSoulPalace}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background-secondary p-3">
                        <p className="text-xs text-muted">身宫</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{ziweiChart.earthlyBranchOfBodyPalace}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background-secondary p-3">
                        <p className="text-xs text-muted">干支纪年</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{ziweiChart.chineseDate}</p>
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {ziweiChart.palaces.map((palace) => {
                        const starText = palace.majorStars.length
                          ? palace.majorStars.map((star) => `${star.name}${star.brightness ? `(${star.brightness})` : ""}${star.mutagen ? `化${star.mutagen}` : ""}`).join("、")
                          : "无主星";
                        return (
                          <div key={`${palace.index}-${palace.name}`} className="rounded-lg border border-border px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {palace.name}
                                {palace.isBodyPalace ? <span className="ml-1 text-[10px] text-accent">身宫</span> : null}
                              </p>
                              <span className="text-[11px] text-muted">{palace.heavenlyStem}{palace.earthlyBranch}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted">{starText}</p>
                            <p className="mt-1 text-[11px] text-muted">
                              大限 {palace.decadal.range[0]}-{palace.decadal.range[1]} · {palace.changsheng12}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {zhouyiChart && (
                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">周易时间卦</h3>
                        <p className="mt-1 text-xs text-muted">
                          {zhouyiChart.calculationBasis.ruleSet} · {zhouyiChart.inputs.lunar.text} · {zhouyiChart.inputs.hourBranch}时
                        </p>
                      </div>
                      <span className="rounded bg-background-secondary px-2 py-1 text-xs text-muted">
                        动爻：第 {zhouyiChart.movingLine} 爻
                      </span>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                      <div className="rounded-lg border border-border bg-background-secondary p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs text-muted">本卦</p>
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-3xl font-black text-foreground">{zhouyiChart.primaryHexagram.symbol}</span>
                              <span className="text-lg font-bold text-foreground">{zhouyiChart.primaryHexagram.name}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted">
                              第 {zhouyiChart.primaryHexagram.kingWenNumber} 卦 · 上{zhouyiChart.upperTrigram.name}下{zhouyiChart.lowerTrigram.name}
                            </p>
                          </div>
                          <div className="w-24 space-y-1">
                            {[...zhouyiChart.primaryHexagram.lines].reverse().map((isYang, index) => {
                              const lineNumber = 6 - index;
                              return (
                                <div key={lineNumber} className="flex h-4 items-center gap-1">
                                  {isYang ? (
                                    <span className="h-1.5 w-full rounded bg-foreground" />
                                  ) : (
                                    <>
                                      <span className="h-1.5 flex-1 rounded bg-muted" />
                                      <span className="h-1.5 flex-1 rounded bg-muted" />
                                    </>
                                  )}
                                  {zhouyiChart.movingLine === lineNumber && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                        {[
                          ["互卦", zhouyiChart.mutualHexagram],
                          ["变卦", zhouyiChart.changedHexagram],
                        ].map(([label, hexagram]) => (
                          <div key={label as string} className="rounded-lg border border-border px-3 py-2">
                            <p className="text-xs text-muted">{label as string}</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {(hexagram as ZhouyiTimeChart["primaryHexagram"]).symbol} {(hexagram as ZhouyiTimeChart["primaryHexagram"]).name}
                            </p>
                            <p className="mt-1 text-[11px] text-muted">
                              第 {(hexagram as ZhouyiTimeChart["primaryHexagram"]).kingWenNumber} 卦
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {tarotChart && (
                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">塔罗牌阵</h3>
                        <p className="mt-1 text-xs text-muted">
                          {tarotChart.spread.name} · {tarotChart.calculationBasis.ruleSet} · seed {tarotChart.calculationBasis.seed}
                        </p>
                      </div>
                      <span className="rounded bg-background-secondary px-2 py-1 text-xs text-muted">
                        {tarotChart.calculationBasis.deck}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      {tarotChart.cards.map((drawn) => (
                        <div key={`${drawn.position.id}-${drawn.card.id}`} className="rounded-lg border border-border bg-background-secondary p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-muted">{drawn.position.name}</p>
                              <h4 className="mt-1 text-base font-bold text-foreground">{drawn.card.name}</h4>
                            </div>
                            <span className="rounded bg-card px-2 py-1 text-[11px] text-muted">
                              {drawn.orientation === "upright" ? "正位" : "逆位"}
                            </span>
                          </div>
                          <p className="mt-3 text-[11px] leading-5 text-muted">{drawn.position.focus}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {drawn.meaning.slice(0, 4).map((keyword) => (
                              <span key={keyword} className="rounded bg-accent/10 px-2 py-1 text-[11px] text-accent">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 to-background p-5 shadow-lg shadow-accent/5">
                  <div className="absolute right-0 top-0 -mr-6 -mt-6 h-32 w-32 rounded-full bg-accent/20 blur-[40px]" />
                  <h3 className="relative mb-4 flex items-center gap-2 text-base font-bold text-foreground">
                    <Sparkles className="h-5 w-5 text-accent" />
                    专属赛博判词
                  </h3>
                  <div className="relative break-words text-sm leading-relaxed text-foreground/90 backdrop-blur-sm">
                    {(() => {
                       const lines = interpretation.split('\n').map(l => l.trim()).filter(Boolean);
                       const verdictIndex = lines.findIndex(l => l.includes('✨') || l.includes('专属赛博判词') || l.includes('分享金句'));
                       
                       const mainLines = verdictIndex === -1 ? lines : lines.slice(0, verdictIndex);
                       const verdictLines = verdictIndex === -1 ? [] : lines.slice(verdictIndex);
                       
                       return (
                         <>
                           <div className="space-y-4">
                             {mainLines.map((line, i) => {
                               // 清洗所有加粗星号和井号
                               const cleanLine = line.replace(/\*\*/g, '').replace(/#/g, '');
                               // 对于标题行加粗处理
                               if (/^一、|^二、|^三、|^四、|^五、|^六、|^七、|^八、/.test(cleanLine)) {
                                 return (
                                   <h4 key={`m-${i}`} className="mt-6 mb-2 text-base font-bold text-foreground flex items-center gap-2">
                                     <div className="w-1.5 h-4 bg-accent rounded-full" />
                                     {cleanLine}
                                   </h4>
                                 );
                               }
                               return <p key={`m-${i}`} className="text-muted-foreground">{cleanLine}</p>;
                             })}
                           </div>
                           
                           {verdictLines.length > 0 && (
                             <div className="mt-8 rounded-xl bg-accent/10 p-5 border-l-4 border-accent shadow-sm relative overflow-hidden">
                               <div className="absolute -top-4 -right-4 p-4 opacity-10">
                                  <Sparkles className="w-24 h-24 text-accent" />
                               </div>
                               {verdictLines.map((line, i) => {
                                 const cleanLine = line.replace(/\*\*/g, '').replace(/^.*?[：:]\s*/, '').replace(/#/g, '');
                                 if (i === 0 && (line.includes('✨') || line.includes('判词'))) {
                                    return <p key={`v-${i}`} className="text-accent font-bold mb-3 flex items-center gap-2">✨ 专属赛博判词</p>;
                                 }
                                 if (!cleanLine) return null;
                                 return <p key={`v-${i}`} className="text-accent/90 text-base font-medium leading-relaxed italic mt-2 relative z-10">{cleanLine}</p>;
                               })}
                             </div>
                           )}
                         </>
                       );
                    })()}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background-secondary p-3 text-[11px] leading-5 text-muted">
                  本功能用于传统文化、娱乐和个人反思参考。格局、旺衰、用神、神煞存在流派差异，不应用作医疗、法律、投资、婚恋等重大决策依据。
                </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        profileName={chart?.profileName || ziweiChart?.profileName || profileName || "未知"}
        methodLabel={methodLabel(activeReading?.method || method)}
        interpretation={interpretation}
        dayPillar={chart?.pillars.day.stem}
        soul={ziweiChart?.soul}
      />
    </div>
  );
}
