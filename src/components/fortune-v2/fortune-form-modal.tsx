"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, X, Loader2, ChevronLeft } from "lucide-react";
import { ModelSelector } from "@/components/chat/model-selector";
import { FORTUNE_LOCATIONS } from "@/lib/fortune/locations";
import type { FortuneReadingRequestDraft } from "@/lib/fortune/request";
import type { FortuneGender, FortuneLocation, FortuneMethod } from "@/lib/fortune/types";

const DEFAULT_LOCATION = FORTUNE_LOCATIONS.find((l) => l.id === "cn-beijing") || FORTUNE_LOCATIONS[0];
const MODEL_STORAGE_KEY = "opencat_fortune_last_model";

const METHOD_THEMES: Record<FortuneMethod, { accent: string; glow: string; label: string }> = {
  bazi: { accent: "var(--fortune-bazi)", glow: "var(--fortune-bazi-glow)", label: "四柱八字" },
  ziwei: { accent: "var(--fortune-ziwei)", glow: "var(--fortune-ziwei-glow)", label: "紫微斗数" },
  zhouyi: { accent: "var(--fortune-zhouyi)", glow: "var(--fortune-zhouyi-glow)", label: "周易时间卦" },
  tarot: { accent: "var(--fortune-tarot)", glow: "var(--fortune-tarot-glow)", label: "塔罗牌阵" },
  xiaoliuren: { accent: "var(--fortune-xiaoliuren)", glow: "var(--fortune-xiaoliuren-glow)", label: "小六壬" },
};

interface FortuneAddressResult extends FortuneLocation {
  id: string;
  adcode: string;
  level: "province" | "city" | "district" | "street";
}

interface FortuneFormModalProps {
  method: FortuneMethod;
  onClose: () => void;
  onSubmit: (data: FortuneReadingRequestDraft) => void;
  isSubmitting: boolean;
}

function nowLocalInputValue() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function FortuneFormModal({ method, onClose, onSubmit, isSubmitting }: FortuneFormModalProps) {
  const theme = METHOD_THEMES[method];
  const [profileName, setProfileName] = useState("");
  const [gender, setGender] = useState<FortuneGender>("male");
  const [birthDateTimeLocal, setBirthDateTimeLocal] = useState("1990-05-17T08:30");
  const [queryDateTimeLocal, setQueryDateTimeLocal] = useState(nowLocalInputValue());
  const [selectedLocation, setSelectedLocation] = useState<FortuneLocation>(DEFAULT_LOCATION);
  const [locationQuery, setLocationQuery] = useState(DEFAULT_LOCATION.name);
  const [locationResults, setLocationResults] = useState<FortuneAddressResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [customLocation, setCustomLocation] = useState<FortuneLocation>({
    name: "", longitude: 116.4074, latitude: 39.9042, timezone: "Asia/Shanghai",
  });
  const [useTrueSolarTime, setUseTrueSolarTime] = useState(false);
  const [modelId, setModelId] = useState("");

  const birthLocation = useCustomLocation ? customLocation : selectedLocation;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      if (saved) setModelId(saved);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (useCustomLocation) return;
    const controller = new AbortController();
    const query = locationQuery.trim();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        params.set("limit", "20");
        const res = await fetch(`/api/fortune/locations?${params}`, { signal: controller.signal, cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setLocationResults(data.locations || []);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) setLocationResults([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 260);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [locationQuery, useCustomLocation]);

  const handleModelChange = useCallback((id: string) => {
    setModelId(id);
    try { if (id) localStorage.setItem(MODEL_STORAGE_KEY, id); } catch { /* noop */ }
  }, []);

  const handleSubmit = () => {
    if (!profileName.trim() || !modelId) return;
    onSubmit({
      method, profileName, gender, birthCalendar: "gregorian", birthDateTimeLocal, queryDateTimeLocal,
      birthLocation, useTrueSolarTime, modelId,
    });
  };

  const needsBirthInfo = method !== "xiaoliuren" && method !== "zhouyi";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div
        className="fortune-modal-panel relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto border p-6"
        style={{
          borderColor: `${theme.accent}22`,
          boxShadow: `0 0 60px -10px ${theme.glow}`,
          animation: "fortune-fade-in-up 0.3s ease-out",
          ["--active-accent" as string]: theme.accent,
          ["--active-glow" as string]: theme.glow,
        }}
      >
        <div className="fortune-modal-rail" />
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button onClick={onClose} className="flex items-center gap-2 text-sm text-[var(--fortune-text-muted)] hover:text-white transition-colors">
            <ChevronLeft className="h-4 w-4" />
            返回
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: `${theme.accent}22`, color: theme.accent, border: `1px solid ${theme.accent}33` }}>
              {theme.label}
            </span>
            <button onClick={onClose} className="text-[var(--fortune-text-muted)] hover:text-white p-1">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-5 border-l px-3 py-2" style={{ borderColor: theme.accent }}>
          <p className="text-sm font-semibold text-white">{theme.label}测算档案</p>
          <p className="mt-1 text-xs leading-5 text-[var(--fortune-text-muted)]">资料只用于本次排盘和当前账户历史记录。</p>
        </div>

        <div className="space-y-4">
          {/* Model selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--fortune-text-muted)]">AI 模型</label>
            <ModelSelector value={modelId} onChange={handleModelChange} />
          </div>

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--fortune-text-muted)]">姓名</label>
            <input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="fortune-input"
              style={{ "--active-accent": theme.accent, "--active-glow": theme.glow } as React.CSSProperties}
              placeholder="请输入姓名"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--fortune-text-muted)]">性别</label>
            <div className="grid grid-cols-3 gap-2">
              {([["male", "男"], ["female", "女"], ["other", "其他"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setGender(val)}
                  className="rounded-xl border px-3 py-2.5 text-sm font-medium transition-all"
                  style={{
                    background: gender === val ? `${theme.accent}18` : "transparent",
                    borderColor: gender === val ? `${theme.accent}66` : "var(--fortune-border)",
                    color: gender === val ? theme.accent : "var(--fortune-text-muted)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Birth time (hidden for xiaoliuren/zhouyi) */}
          {needsBirthInfo && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--fortune-text-muted)]">公历出生时间</label>
              <input
                type="datetime-local"
                value={birthDateTimeLocal}
                onChange={(e) => setBirthDateTimeLocal(e.target.value)}
                className="fortune-input"
                style={{ "--active-accent": theme.accent, "--active-glow": theme.glow, colorScheme: "dark" } as React.CSSProperties}
              />
            </div>
          )}

          {/* Query time */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--fortune-text-muted)]">
              {method === "xiaoliuren" || method === "zhouyi" ? "起卦时间" : "起盘/测算时间"}
            </label>
            <input
              type="datetime-local"
              value={queryDateTimeLocal}
              onChange={(e) => setQueryDateTimeLocal(e.target.value)}
              className="fortune-input"
              style={{ "--active-accent": theme.accent, "--active-glow": theme.glow, colorScheme: "dark" } as React.CSSProperties}
            />
          </div>

          {/* Location (hidden for xiaoliuren) */}
          {method !== "xiaoliuren" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--fortune-text-muted)]">出生地区</label>
                <button
                  onClick={() => setUseCustomLocation((v) => !v)}
                  className="text-xs font-medium"
                  style={{ color: theme.accent }}
                >
                  {useCustomLocation ? "使用城市库" : "手动经纬度"}
                </button>
              </div>

              {useCustomLocation ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={customLocation.name}
                    onChange={(e) => setCustomLocation({ ...customLocation, name: e.target.value })}
                    className="fortune-input col-span-2"
                    style={{ "--active-accent": theme.accent, "--active-glow": theme.glow } as React.CSSProperties}
                    placeholder="地区名称"
                  />
                  <input
                    type="number"
                    value={customLocation.longitude}
                    onChange={(e) => setCustomLocation({ ...customLocation, longitude: Number(e.target.value) })}
                    className="fortune-input"
                    style={{ "--active-accent": theme.accent, "--active-glow": theme.glow } as React.CSSProperties}
                    placeholder="经度"
                  />
                  <input
                    type="number"
                    value={customLocation.latitude}
                    onChange={(e) => setCustomLocation({ ...customLocation, latitude: Number(e.target.value) })}
                    className="fortune-input"
                    style={{ "--active-accent": theme.accent, "--active-glow": theme.glow } as React.CSSProperties}
                    placeholder="纬度"
                  />
                  <input
                    value={customLocation.timezone}
                    onChange={(e) => setCustomLocation({ ...customLocation, timezone: e.target.value })}
                    className="fortune-input col-span-2"
                    style={{ "--active-accent": theme.accent, "--active-glow": theme.glow } as React.CSSProperties}
                    placeholder="Asia/Shanghai"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fortune-text-muted)]" />
                    <input
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      className="fortune-input pl-9"
                      style={{ "--active-accent": theme.accent, "--active-glow": theme.glow } as React.CSSProperties}
                      placeholder="搜索省/市/区"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--fortune-text-muted)]" />
                    )}
                  </div>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-[var(--fortune-border)] bg-black/30">
                    {locationResults.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-[var(--fortune-text-muted)]">
                        {isSearching ? "搜索中..." : "无匹配，可切换手动经纬度"}
                      </p>
                    ) : (
                      locationResults.map((loc) => (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => { setSelectedLocation(loc); setLocationQuery(loc.name); }}
                          className="block w-full border-b border-[var(--fortune-border)] px-3 py-2 text-left last:border-b-0 transition-colors"
                          style={{
                            background: selectedLocation.id === loc.id ? `${theme.accent}12` : "transparent",
                          }}
                        >
                          <span className="block text-sm text-white">{loc.name}</span>
                          <span className="text-[11px] text-[var(--fortune-text-muted)]">
                            {loc.longitude.toFixed(4)}, {loc.latitude.toFixed(4)} · {loc.timezone}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* True solar time (only for bazi/ziwei) */}
          {(method === "bazi" || method === "ziwei") && (
            <label className="flex items-start gap-3 rounded-xl border border-[var(--fortune-border)] p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useTrueSolarTime}
                onChange={(e) => setUseTrueSolarTime(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded"
                style={{ accentColor: theme.accent }}
              />
              <span>
                <span className="block text-sm font-medium text-white">启用真太阳时修正</span>
                <span className="text-xs leading-5 text-[var(--fortune-text-muted)]">
                  根据出生地经度修正时间，可能影响时柱或临界日柱。
                </span>
              </span>
            </label>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !profileName.trim() || !modelId}
            className="fortune-btn-primary w-full mt-2"
            style={
              {
                "--active-accent": theme.accent,
                "--active-accent-hover": theme.accent,
                "--active-glow": theme.glow,
              } as React.CSSProperties
            }
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在测算...
              </span>
            ) : (
              `开始${theme.label}测算`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
