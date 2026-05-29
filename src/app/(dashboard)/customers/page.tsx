"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Users, Sparkles, AlertCircle, Plus, Search, 
  Filter, Building2, DollarSign, ArrowRight, Loader2, Play 
} from "lucide-react";
import Link from "next/link";
import { IntentBadge, SignalBadge, StageBadge } from "@/components/customers/badges";
import { useTranslation } from "@/lib/i18n";
import { signOut } from "next-auth/react";

// 客户类型定义
interface CustomerItem {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  size: string | null;
  budget: number | null;
  stage: "LEAD" | "TRIAL" | "OPPORTUNITY" | "CUSTOMER" | "CHURNED";
  updatedAt: string;
  leads: any[];
  signals: { type: string; level: string }[];
  recommendations: { intentScore: string }[];
}

export default function CustomersPage() {
  const { t, locale } = useTranslation();
  const isEn = locale === "en";
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 筛选器状态
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [industryFilter, setIndustryFilter] = useState("");

  // 新增客户表单弹窗
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    industry: "",
    size: "1-50人",
    budget: 0,
    stage: "LEAD",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // 1. 获取客户列表
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/customers";
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (stageFilter !== "ALL") params.append("stage", stageFilter);
      if (industryFilter) params.append("industry", industryFilter);
      
      const queryStr = params.toString();
      if (queryStr) url += `?${queryStr}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.data || []);
      }
    } catch (error) {
      console.error("加载客户列表异常:", error);
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter, industryFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // 2. 创建客户提交
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) return;

    setSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newCustomer,
          budget: newCustomer.budget ? Number(newCustomer.budget) : null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowAddModal(false);
        setNewCustomer({
          name: "",
          contactName: "",
          email: "",
          phone: "",
          industry: "",
          size: "1-50人",
          budget: 0,
          stage: "LEAD",
        });
        fetchCustomers();
      } else {
        setFormError(data.error?.message || "创建客户失败");
        if (res.status === 401) {
          setTimeout(() => {
            signOut({ callbackUrl: "/login" });
          }, 1500);
        }
      }
    } catch {
      setFormError("网关通讯异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  // 3. 统计头部核心指标
  const totalCount = customers.length;
  const hotCount = customers.filter(
    (c) => c.recommendations[0]?.intentScore === "hot"
  ).length;
  const riskCount = customers.filter(
    (c) => c.signals.length > 0 || c.stage === "CHURNED"
  ).length;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 space-y-8">
        
        {/* ---- 头部 Title & 创建按钮 ---- */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{t("customers.title")}</h1>
            <p className="text-sm text-muted">{t("customers.subtitle")}</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background hover:opacity-85 shadow transition-all duration-150"
          >
            <Plus className="h-4 w-4" />
            {t("customers.addCustomer")}
          </button>
        </div>

        {/* ---- 指标看板 (Stats Area) ---- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{t("customers.totalCustomers")}</p>
              <h4 className="text-xl font-extrabold text-foreground mt-0.5">
                {totalCount} <span className="text-xs font-medium text-muted">{isEn ? "Items" : "个主体"}</span>
              </h4>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Sparkles className="h-5 w-5 fill-amber-500/10" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{t("customers.hotIntent")}</p>
              <h4 className="text-xl font-extrabold text-foreground mt-0.5">
                {hotCount} <span className="text-xs font-medium text-muted">{isEn ? "Hot Customers" : "个 Hot 客户"}</span>
              </h4>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{t("customers.churnRisk")}</p>
              <h4 className="text-xl font-extrabold text-foreground mt-0.5">
                {riskCount} <span className="text-xs font-medium text-muted">{isEn ? "Signals" : "个异常信号"}</span>
              </h4>
            </div>
          </div>
        </div>

        {/* ---- 筛选与过滤区域 ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background-secondary p-4">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* 搜索框 */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted/60" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("customers.searchPlaceholder")}
                className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
              />
            </div>
            {/* 行业过滤 */}
            <div className="relative w-full sm:w-40">
              <Building2 className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted/60" />
              <input
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                placeholder={isEn ? "Filter Industry..." : "过滤行业..."}
                className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
              />
            </div>
          </div>

          {/* 销售阶段快速切换标签 */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider hidden md:inline">
              {t("customers.stage")}:
            </span>
            {["ALL", "LEAD", "TRIAL", "OPPORTUNITY", "CUSTOMER", "CHURNED"].map((st) => (
              <button
                key={st}
                onClick={() => setStageFilter(st)}
                className={`rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150 ${
                  stageFilter === st
                    ? "bg-foreground text-background font-medium"
                    : "border border-border bg-card text-muted hover:text-foreground hover:bg-[var(--sidebar-hover)]"
                }`}
              >
                {st === "ALL" 
                  ? (isEn ? "All" : "全部") 
                  : t(`stages.${st}` as any)}
              </button>
            ))}
          </div>
        </div>

        {/* ---- 客户卡片列表 ---- */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : customers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
            <Users className="mx-auto h-10 w-10 text-muted/30" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">{t("customers.noCustomers")}</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">{t("customers.noCustomersDesc")}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {customers.map((c) => {
              const latestRecScore = c.recommendations[0]?.intentScore;
              
              return (
                <div
                  key={c.id}
                  className="group rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm hover:border-accent/30 hover:shadow transition-all duration-200"
                >
                  {/* 首行：名称 & 阶段 */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/customers/${c.id}`}>
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors flex items-center gap-1.5">
                          {c.name}
                          <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-accent" />
                        </h3>
                      </Link>
                      {c.contactName && (
                        <p className="text-[11px] text-muted mt-0.5">
                          {isEn ? "Contact: " : "联系人: "}{c.contactName}
                        </p>
                      )}
                    </div>
                    <StageBadge stage={c.stage} />
                  </div>

                  {/* 信息项：行业、大小、预算 */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
                    {c.industry && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 opacity-70" />
                        {c.industry}
                      </span>
                    )}
                    {c.budget && (
                      <span className="flex items-center gap-0.5 font-medium text-foreground/80">
                        <DollarSign className="h-3.5 w-3.5 opacity-70" />
                        {c.budget.toLocaleString(isEn ? "en-US" : "zh-CN")}
                      </span>
                    )}
                    <span className="text-[10px] opacity-70">
                      {isEn ? "Updated: " : "最近更新: "}{new Date(c.updatedAt).toLocaleDateString(isEn ? "en-US" : "zh-CN")}
                    </span>
                  </div>

                  {/* 分割线 */}
                  <div className="border-t border-border/80" />

                  {/* 底行：意向等级徽标 + 异常风险预警信号 */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* 意向评级 */}
                    <div>
                      {latestRecScore ? (
                        <IntentBadge score={latestRecScore} />
                      ) : (
                        <span className="text-[10px] text-muted/60">{isEn ? "Pending AI" : "待 AI 诊断"}</span>
                      )}
                    </div>
                    
                    {/* 风险信号角标 */}
                    <div className="flex flex-wrap gap-1">
                      {c.signals.slice(0, 2).map((sig, idx) => (
                        <SignalBadge key={idx} type={sig.type} level={sig.level} />
                      ))}
                      {c.signals.length > 2 && (
                        <span className="rounded bg-zinc-100 dark:bg-zinc-800 text-[9px] text-muted px-1.5 py-0.5">
                          +{c.signals.length - 2} {isEn ? "Signals" : "信号"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---- 录入线索弹窗 (Create Customer Modal) ---- */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <form onSubmit={handleCreateCustomer} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xl">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {isEn ? "Log New B2B Lead Customer" : "录入新客户/线索资料"}
                </h3>
                <p className="text-[11px] text-muted">
                  {isEn 
                    ? "Input business profiles, automatically bound to current workspace to start diagnostics." 
                    : "录入客户的业务属性，自动绑定当前组织以开始智能诊断跟进。"}
                </p>
              </div>

              {formError && <p className="text-xs text-danger">{formError}</p>}

              <div className="space-y-3">
                {/* 客户公司名称 */}
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-muted uppercase tracking-wider">
                    {t("customers.name") + " *"}
                  </label>
                  <input
                    required
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder={isEn ? "e.g. Acme Corp" : "例如: 杭州奇妙科技有限公司"}
                    className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* 联系人名字 */}
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted uppercase tracking-wider">
                      {t("customers.contact")}
                    </label>
                    <input
                      value={newCustomer.contactName}
                      onChange={(e) => setNewCustomer({ ...newCustomer, contactName: e.target.value })}
                      placeholder={isEn ? "Manager Smith" : "张经理"}
                      className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                    />
                  </div>
                  {/* 电话 */}
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted uppercase tracking-wider">
                      {t("customers.phone")}
                    </label>
                    <input
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      placeholder="138xxxxxxxx"
                      className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                    />
                  </div>
                </div>

                {/* 邮箱 */}
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-muted uppercase tracking-wider">
                    {t("customers.email")}
                  </label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    placeholder="contact@company.com"
                    className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* 行业 */}
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted uppercase tracking-wider">
                      {t("customers.industry")}
                    </label>
                    <input
                      value={newCustomer.industry}
                      onChange={(e) => setNewCustomer({ ...newCustomer, industry: e.target.value })}
                      placeholder="B2B SaaS"
                      className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                    />
                  </div>
                  {/* 预算 */}
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted uppercase tracking-wider">
                      {t("customers.budget")} (USD)
                    </label>
                    <input
                      type="number"
                      value={newCustomer.budget || ""}
                      onChange={(e) => setNewCustomer({ ...newCustomer, budget: Number(e.target.value) })}
                      placeholder="50000"
                      className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                    />
                  </div>
                </div>

                {/* 阶段 */}
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-muted uppercase tracking-wider">
                    {isEn ? "Initial Stage" : "初始生命周期阶段"}
                  </label>
                  <select
                    value={newCustomer.stage}
                    onChange={(e) => setNewCustomer({ ...newCustomer, stage: e.target.value })}
                    className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-xs outline-none focus:border-accent/50 text-foreground"
                  >
                    <option value="LEAD">{t("stages.LEAD")}</option>
                    <option value="TRIAL">{t("stages.TRIAL")}</option>
                    <option value="OPPORTUNITY">{t("stages.OPPORTUNITY")}</option>
                    <option value="CUSTOMER">{t("stages.CUSTOMER")}</option>
                  </select>
                </div>
              </div>

              {/* 弹窗按钮 */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="submit"
                  disabled={submitting || !newCustomer.name.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-85 disabled:opacity-40"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isEn ? "Register & Import" : "录入建档"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg px-4 py-2 text-xs text-muted hover:text-foreground"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
