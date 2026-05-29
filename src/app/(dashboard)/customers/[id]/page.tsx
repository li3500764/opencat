"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { 
  Building2, Mail, Phone, Calendar, ArrowLeft, 
  Loader2, Sparkles, AlertCircle, DollarSign, Award, CheckCircle
} from "lucide-react";
import Link from "next/link";
import { IntentBadge, StageBadge, SignalBadge } from "@/components/customers/badges";
import { InteractionTimeline } from "@/components/customers/timeline";
import { RecommendationCard } from "@/components/customers/recommendation";
import { useTranslation } from "@/lib/i18n";

interface CustomerDetail {
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
  interactions: any[];
  signals: { id: string; type: string; level: string; description: string; isResolved: boolean }[];
  recommendations: any[];
  outcomes: any[];
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale } = useTranslation();
  const isEn = locale === "en";

  const resolvedParams = use(params);
  const customerId = resolvedParams.id;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 修改阶段下拉状态
  const [stageUpdating, setStageUpdating] = useState(false);

  // 1. 获取客户详情 360 立体数据
  const fetchCustomerDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      const data = await res.json();
      if (res.ok) {
        setCustomer(data.data);
      } else {
        setErrorMsg(data.error?.message || "获取客户详情失败");
      }
    } catch {
      setErrorMsg("网络错误，无法加载客户详情");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomerDetail();
  }, [fetchCustomerDetail]);

  // 2. 手动流转客户跟进生命周期阶段
  const handleStageChange = async (newStage: string) => {
    setStageUpdating(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) {
        fetchCustomerDetail();
      }
    } catch (error) {
      console.error("更新阶段异常:", error);
    } finally {
      setStageUpdating(false);
    }
  };

  // 3. 触发 AI 诊断分析
  const handleTriggerAnalysis = async () => {
    setAnalyzing(true);
    try {
      // 模拟调用 Day 10 即将完成的分析接口，第一版在此处做模拟写回
      const res = await fetch(`/api/customers/${customerId}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        fetchCustomerDetail();
      }
    } catch (error) {
      console.error("AI 诊断异常:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (errorMsg || !customer) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-6 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-danger" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">无法加载客户详情</h3>
          <p className="text-xs text-muted">{errorMsg || "未找到该客户资料或无权查看"}</p>
        </div>
        <Link
          href="/customers"
          className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-85"
        >
          返回客户列表
        </Link>
      </div>
    );
  }

  // 最新的一条 AI 建议
  const latestRec = customer.recommendations[0] || null;
  // 未处理的活跃信号
  const activeSignals = customer.signals.filter((s) => !s.isResolved);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 space-y-6">
        
        {/* ---- 头部返回导航 ---- */}
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:bg-[var(--sidebar-hover)] hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-foreground">{customer.name}</h1>
              <StageBadge stage={customer.stage} />
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              {isEn ? "Customer ID: " : "客户 ID: "}{customer.id} · {isEn ? "Created: " : "建档日期: "}
              {new Date(customer.updatedAt).toLocaleDateString(isEn ? "en-US" : "zh-CN")}
            </p>
          </div>
        </div>

        {/* ---- 主分栏布局 (两栏) ---- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* ================= 左栏：客户画像与活跃信号 ================= */}
          <div className="space-y-6 lg:col-span-1">
            
            {/* 客户详细档案卡片 */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider pb-2 border-b border-border">
                {t("customerDetail.profile")}
              </h3>
              
              <div className="space-y-3 text-xs">
                {/* 负责人 */}
                <div className="flex justify-between">
                  <span className="text-muted">{t("customerDetail.owner")}</span>
                  <span className="font-semibold text-foreground">{isEn ? "Sales Manager" : "销售经理"}</span>
                </div>
                {/* 联系人 */}
                <div className="flex justify-between">
                  <span className="text-muted">{t("customers.contact")}</span>
                  <span className="font-medium text-foreground">{customer.contactName || (isEn ? "Not Specified" : "未填写")}</span>
                </div>
                {/* 行业 */}
                <div className="flex justify-between">
                  <span className="text-muted">{t("customers.industry")}</span>
                  <span className="font-medium text-foreground flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 opacity-65 text-accent" />
                    {customer.industry || (isEn ? "Not Specified" : "未分类")}
                  </span>
                </div>
                {/* 公司规模 */}
                <div className="flex justify-between">
                  <span className="text-muted">{t("customerDetail.size")}</span>
                  <span className="font-medium text-foreground">{customer.size || (isEn ? "Not Specified" : "未填写")}</span>
                </div>
                {/* 预算 */}
                <div className="flex justify-between">
                  <span className="text-muted">{t("customerDetail.budget")}</span>
                  <span className="font-semibold text-foreground flex items-center">
                    <DollarSign className="h-3 w-3 text-emerald-500" />
                    {customer.budget ? `${customer.budget.toLocaleString(isEn ? "en-US" : "zh-CN")} USD` : (isEn ? "Not Specified" : "未填写")}
                  </span>
                </div>
                
                {/* 邮箱 */}
                {customer.email && (
                  <div className="flex justify-between items-center pt-1 border-t border-border/80">
                    <span className="text-muted flex items-center gap-1"><Mail className="h-3.5 w-3.5 opacity-60" /> {t("customers.email")}</span>
                    <a href={`mailto:${customer.email}`} className="text-accent font-medium hover:underline truncate max-w-[140px]">{customer.email}</a>
                  </div>
                )}
                {/* 电话 */}
                {customer.phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted flex items-center gap-1"><Phone className="h-3.5 w-3.5 opacity-60" /> {isEn ? "Phone" : "电话"}</span>
                    <span className="font-medium text-foreground">{customer.phone}</span>
                  </div>
                )}
              </div>

              {/* 手动流转跟进阶段 */}
              <div className="border-t border-border pt-3 space-y-2">
                <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider">
                  {t("customerDetail.stageSelect")}
                </label>
                <div className="relative">
                  <select
                    disabled={stageUpdating}
                    value={customer.stage}
                    onChange={(e) => handleStageChange(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input-bg px-2.5 py-1.5 text-xs outline-none focus:border-accent/50 disabled:opacity-40 text-foreground"
                  >
                    <option value="LEAD">{t("stages.LEAD")}</option>
                    <option value="TRIAL">{t("stages.TRIAL")}</option>
                    <option value="OPPORTUNITY">{t("stages.OPPORTUNITY")}</option>
                    <option value="CUSTOMER">{t("stages.CUSTOMER")}</option>
                    <option value="CHURNED">{t("stages.CHURNED")}</option>
                  </select>
                  {stageUpdating && (
                    <div className="absolute right-8 top-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 活跃风险预警信号卡片 */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider pb-2 border-b border-border flex items-center justify-between">
                <span>{isEn ? "Real-time Alerts" : "实时预警信号"}</span>
                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-600 dark:text-red-400">
                  {activeSignals.length} {isEn ? "Active" : "活跃"}
                </span>
              </h3>

              {activeSignals.length === 0 ? (
                <div className="py-4 text-center space-y-2">
                  <CheckCircle className="mx-auto h-6 w-6 text-emerald-500/80" />
                  <p className="text-[11px] text-muted">{t("customerDetail.noSignals")}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeSignals.map((sig) => (
                    <div key={sig.id} className="rounded-lg bg-background-secondary p-2.5 border border-border space-y-1">
                      <div className="flex items-center justify-between">
                        <SignalBadge type={sig.type} level={sig.level} />
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed">
                        {sig.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ================= 右栏：AI 诊断建议与历史沟通时间线 ================= */}
          <div className="space-y-6 lg:col-span-2">
            
            {/* AI 诊断卡片 (人机协作面板) */}
            <RecommendationCard
              customerId={customer.id}
              recommendation={latestRec}
              onReviewSuccess={fetchCustomerDetail}
              onAnalyzeTrigger={handleTriggerAnalysis}
              analyzing={analyzing}
            />

            {/* 沟通记录历史时间线 */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <InteractionTimeline
                customerId={customer.id}
                interactions={customer.interactions}
                onAddSuccess={fetchCustomerDetail}
              />
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
