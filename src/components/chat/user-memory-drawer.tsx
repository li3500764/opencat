// ============================================================
// UserMemoryDrawer — 长期记忆抽屉面板（Premium 磨砂金黄质感）
// ============================================================
//
// 视觉设计：
//   - 极致毛玻璃背景 (backdrop-blur-md bg-card/85)
//   - 细微的古铜金边缘发光与柔和阴影，与高端 CRM 画风统一
//   - 入场动效：右侧滑入 (transition-transform duration-300 ease-out)
//
// 业务逻辑：
//   - 对应用户配图的四大分类：偏好、背景、行为、工作流
//   - 徽章标明范围：🌐 全局生效 / 💬 仅本对话
//   - 支持手动添加（文字 + 图片 URL + 范围选择）
//   - 支持一键删除与实时反馈
// ============================================================

"use client";

import { useState, useEffect } from "react";
import { 
  X, Plus, Trash2, Heart, User, Zap, GitBranch, 
  Globe, MessageSquare, ImageIcon, Loader2, Sparkles 
} from "lucide-react";

interface MemoryItem {
  id: string;
  content: string;
  category: "preference" | "background" | "behavior" | "project_context" | "fact" | "workflow";
  importance: number;
  conversationId: string | null;
  imageUrl: string | null;
  createdAt: string;
}

interface UserMemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string | null;
}

export function UserMemoryDrawer({ isOpen, onClose, conversationId }: UserMemoryDrawerProps) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 新增表单状态
  const [activeAddCategory, setActiveAddCategory] = useState<string | null>(null);
  const [newContent, setNewContent] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newScope, setNewScope] = useState<"global" | "conversation">("global");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 灯箱大图预览状态
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // 1. 获取记忆数据
  const fetchMemories = async () => {
    try {
      setLoading(true);
      const url = conversationId 
        ? `/api/memory?conversationId=${conversationId}`
        : `/api/memory`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error("加载记忆失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMemories();
    }
  }, [isOpen, conversationId]);

  // 2. 新增记忆提交
  const handleAddMemory = async (category: string) => {
    if (!newContent.trim()) return;
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newContent,
          category,
          conversationId: newScope === "conversation" ? conversationId : null,
          imageUrl: newImageUrl.trim() || null,
        }),
      });

      if (res.ok) {
        // 重置状态
        setNewContent("");
        setNewImageUrl("");
        setActiveAddCategory(null);
        // 重新获取列表
        await fetchMemories();
      }
    } catch (err) {
      console.error("添加记忆失败:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. 删除记忆
  const handleDeleteMemory = async (id: string) => {
    // 乐观更新：先在 UI 里剔除，以求瞬间响应
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch("/api/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error("删除记忆失败:", err);
      // 失败后重新拉取
      fetchMemories();
    }
  };

  // 4. 将后端记忆类别映射为 UI 的四大分类
  const categoriesDef = [
    {
      key: "preference",
      label: "偏好",
      desc: "喜好、厌恶、风格偏好",
      icon: Heart,
      colorClass: "text-[#E0A96D]",
      bgColorClass: "bg-[#E0A96D]/10",
    },
    {
      key: "background",
      label: "背景",
      desc: "行业、角色、技能、经验",
      icon: User,
      colorClass: "text-[#9F7A53]",
      bgColorClass: "bg-[#9F7A53]/10",
    },
    {
      key: "behavior",
      label: "行为",
      desc: "交互习惯与决策倾向",
      icon: Zap,
      colorClass: "text-[#D4A373]",
      bgColorClass: "bg-[#D4A373]/10",
    },
    {
      key: "workflow",
      label: "工作流",
      desc: "常用流程、工具链与协作方式",
      icon: GitBranch,
      colorClass: "text-[#C2956E]",
      bgColorClass: "bg-[#C2956E]/10",
    },
  ];

  return (
    <>
      {/* 抽屉背板遮罩 */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300"
        />
      )}

      {/* 右侧抽屉主体 */}
      <div 
        className={`fixed right-0 top-0 z-50 h-full w-[400px] border-l border-border/60 bg-card/85 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-out flex flex-col border-t-foreground/5
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
        style={{
          boxShadow: "-10px 0 40px rgba(0, 0, 0, 0.15), inset 1px 0 0 rgba(212, 163, 89, 0.08)"
        }}
      >
        {/* 顶部标题栏 */}
        <div className="flex h-14 items-center justify-between border-b border-border/50 px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/[0.04]">
              <Sparkles className="h-4 w-4 text-[#D4A373]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">关于你</h2>
              <p className="text-[10px] text-muted">AI 自动沉淀的长期画像</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-foreground/[0.04] hover:text-foreground transition-all active:scale-[0.9]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 滚动内容区 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">
          {loading ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
              <span className="text-xs text-muted">正在唤醒记忆...</span>
            </div>
          ) : (
            categoriesDef.map((cat) => {
              const catItems = memories.filter((m) => m.category === cat.key);
              const CatIcon = cat.icon;
              const isAdding = activeAddCategory === cat.key;

              return (
                <div key={cat.key} className="group/cat rounded-2xl border border-border/40 bg-foreground/[0.01] p-4 hover:bg-foreground/[0.02] hover:border-border/60 transition-all duration-300">
                  {/* 分类 Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl ${cat.bgColorClass} ${cat.colorClass}`}>
                        <CatIcon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-foreground">{cat.label}</h3>
                        <p className="text-[10px] text-muted leading-relaxed">{cat.desc}</p>
                      </div>
                    </div>

                    {/* 添加按钮 */}
                    {!isAdding && (
                      <button 
                        onClick={() => {
                          setActiveAddCategory(cat.key);
                          setNewScope("global");
                        }}
                        className="opacity-0 group-hover/cat:opacity-100 flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-foreground/[0.04] hover:text-foreground transition-all duration-200"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 新增 Inline 表单 */}
                  {isAdding && (
                    <div className="mt-4 border-t border-border/30 pt-3 space-y-2.5 animate-fadeIn">
                      <textarea
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        placeholder={`添加新的${cat.label}，例如：经常催促销活动进度...`}
                        className="w-full min-h-[50px] rounded-xl border border-border/80 bg-background/50 p-2.5 text-xs text-foreground placeholder-muted focus:border-foreground/30 focus:outline-none resize-none transition-colors"
                      />
                      
                      {/* 图片可选输入 */}
                      <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/25 px-2 py-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-muted shrink-0" />
                        <input
                          type="text"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          placeholder="可选：粘贴参考图片链接(URL)"
                          className="w-full bg-transparent text-[11px] text-foreground focus:outline-none placeholder-muted"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        {/* 范围选择 */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setNewScope("global")}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all border
                              ${newScope === "global" 
                                ? "bg-foreground/[0.03] border-border/80 text-foreground" 
                                : "bg-transparent border-transparent text-muted hover:text-foreground"
                              }
                            `}
                          >
                            <Globe className="h-3 w-3" /> 全局
                          </button>
                          
                          {conversationId && (
                            <button
                              onClick={() => setNewScope("conversation")}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all border
                                ${newScope === "conversation" 
                                  ? "bg-foreground/[0.03] border-border/80 text-foreground" 
                                  : "bg-transparent border-transparent text-muted hover:text-foreground"
                                }
                              `}
                            >
                              <MessageSquare className="h-3 w-3" /> 仅本对话
                            </button>
                          )}
                        </div>

                        {/* 提交/取消 */}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setActiveAddCategory(null)}
                            className="px-2.5 py-1 text-[10px] text-muted hover:text-foreground transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => handleAddMemory(cat.key)}
                            disabled={isSubmitting || !newContent.trim()}
                            className="flex items-center gap-1 rounded-md bg-foreground px-3 py-1 text-[10px] font-medium text-background hover:bg-foreground/90 disabled:opacity-50 transition-all"
                          >
                            {isSubmitting && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                            保存
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 条目列表 */}
                  <div className="mt-3.5 space-y-2">
                    {catItems.length === 0 ? (
                      <p className="text-[10px] text-muted/60 italic pl-11">暂无记忆</p>
                    ) : (
                      catItems.map((item) => (
                        <div 
                          key={item.id}
                          className="group/item flex items-start gap-3 rounded-xl hover:bg-foreground/[0.02] p-2 -mx-2 transition-colors relative"
                        >
                          {/* 范围指示点 */}
                          <div className="mt-2.5 shrink-0 flex items-center justify-center">
                            {item.conversationId ? (
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-500/80" title="当前对话生效" />
                            ) : (
                              <div className="h-1.5 w-1.5 rounded-full bg-[#D4A373]/80" title="全局生效" />
                            )}
                          </div>

                          <div className="flex-1 space-y-1.5 min-w-0 pr-6">
                            {/* 记忆文本 */}
                            <p className="text-xs text-foreground/95 break-words leading-relaxed">
                              {item.content}
                            </p>

                            {/* 配图 */}
                            {item.imageUrl && (
                              <div className="relative group/img max-w-[120px] rounded-lg overflow-hidden border border-border/40 bg-foreground/[0.02]">
                                <img
                                  src={item.imageUrl}
                                  alt="记忆配图"
                                  onClick={() => setLightboxImage(item.imageUrl)}
                                  className="w-full h-16 object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    // 容错：加载失败则隐藏图片
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              </div>
                            )}

                            {/* 范围 & 时间 Badge */}
                            <div className="flex items-center gap-1.5">
                              {item.conversationId ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium bg-blue-500/[0.05] text-blue-500 border border-blue-500/10">
                                  <MessageSquare className="h-2.5 w-2.5" /> 仅本对话
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium bg-[#D4A373]/[0.05] text-[#D4A373] border border-[#D4A373]/20">
                                  <Globe className="h-2.5 w-2.5" /> 全局生效
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 删除小垃圾桶 */}
                          <button
                            onClick={() => handleDeleteMemory(item.id)}
                            className="absolute right-2 top-2 opacity-0 group-hover/item:opacity-100 flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500 transition-all duration-200"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 灯箱大图预览 Modal */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn cursor-zoom-out"
        >
          <div className="max-w-[90%] max-h-[85%] rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl p-1 animate-scaleIn">
            <img 
              src={lightboxImage} 
              alt="记忆大图预览" 
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
