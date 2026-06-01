// ============================================================
// AI Prompt Generator API (AI 自动生成 Agent 系统提示词)
// ============================================================
//
// 功能：根据用户输入的 Agent 名称和描述，自动通过大模型生成一份专业的系统提示词（System Prompt）
//
// 逻辑流程：
//   1. 校验用户登录状态
//   2. 校验传入的名称参数
//   3. 寻找用户已激活的 API 密钥与模型。若无配置，回退到系统环境变量
//   4. 组装精心调优的 Prompt 模版，调用大模型生成专业的 Prompt
//   5. 返回生成的 System Prompt 内容给前端
//
// ============================================================

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { decrypt } from "@/lib/crypto";
import { createModel, type ApiFormat } from "@/lib/llm";
import { generateText } from "ai";

export async function POST(req: Request) {
  try {
    // ---- 1. 鉴权 ----
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "未授权访问" }, { status: 401 });
    }
    const userId = session.user.id;

    // ---- 2. 解析请求体 ----
    const body = await req.json();
    const { name, description } = body as {
      name: string;
      description?: string;
    };

    if (!name || !name.trim()) {
      return Response.json({ error: "Agent 名称为必填项" }, { status: 400 });
    }

    // ---- 3. 获取 API Key 和模型配置 ----
    let apiKey: string | null = null;
    let baseUrl: string | undefined;
    let keyFormat: string | undefined;
    let modelId: string = "gpt-4o-mini"; // 默认回退的轻量且表现优秀模型
    let providerId: string = "openai";

    // 查找用户已激活的 API 密钥配置
    const userKey = await db.apiKey.findFirst({
      where: { userId, isActive: true },
    });

    if (userKey) {
      apiKey = decrypt(userKey.encryptedKey, userKey.iv);
      baseUrl = userKey.baseUrl || undefined;
      keyFormat = userKey.format || undefined;
      providerId = userKey.provider || "openai";

      // 尝试解析并读取该 Provider 关联的第一个模型
      try {
        const models = (userKey.models as any) || [];
        if (models.length > 0 && models[0].id) {
          modelId = models[0].id;
        }
      } catch (err) {
        console.error("[Generate Prompt API] 解析 models JSON 失败:", err);
      }
    } else {
      // 若无配置，尝试回退到系统环境变量
      if (process.env.DEEPSEEK_API_KEY) {
        apiKey = process.env.DEEPSEEK_API_KEY;
        modelId = "deepseek-chat";
        providerId = "deepseek";
      } else if (process.env.OPENAI_API_KEY) {
        apiKey = process.env.OPENAI_API_KEY;
        modelId = "gpt-4o-mini";
        providerId = "openai";
      } else if (process.env.ANTHROPIC_API_KEY) {
        apiKey = process.env.ANTHROPIC_API_KEY;
        modelId = "claude-3-5-haiku-20241022";
        providerId = "anthropic";
      } else if (process.env.GOOGLE_API_KEY) {
        apiKey = process.env.GOOGLE_API_KEY;
        modelId = "gemini-2.5-flash";
        providerId = "google";
      }
    }

    // 仍无可用的 API 密钥则返回错误提示
    if (!apiKey) {
      return Response.json(
        { error: "未找到可用的 API 密钥。请在「设置 -> API 密钥」中配置，或配置系统环境变量。" },
        { status: 400 }
      );
    }

    // ---- 4. 创建模型实例 ----
    const model = createModel(modelId, apiKey, {
      baseUrl,
      providerId,
      format: keyFormat as ApiFormat | undefined,
    });

    // ---- 5. 编写生成提示词的 Prompt ----
    const promptText = `你是一个拥有 15 年经验的前端架构师和人工智能提示词专家。
你的任务是根据用户输入的 AI Agent 名称和描述，为他设计一份极为专业、结构清晰且表现优良的系统提示词（System Prompt）。

输入信息如下：
- Agent 名称：${name}
- Agent 描述：${description || "未提供详细描述，请基于名称进行合理发挥与发散"}

系统提示词的设计要求：
1. 语言：一律使用中文进行编写与回复，且生成的内容必须十分自然得体。
2. 结构：使用精美的 Markdown 格式，通常包含以下部分：
   - # 角色定位 (Role & Objective)：简要明确 Agent 的核心身份与终极目标。
   - ## 核心技能与工作流 (Capabilities & Workflow)：列举其具备的核心能力及执行步骤。
   - ## 交互准则 (Rules of Interaction)：比如回复的语气、格式要求、边界条件（什么做，什么不做）。
   - ## 输出格式样例 (Output Format Example)：如果适用，提供一个优雅的输出模板。
3. 专业度：生成的提示词必须能直接被大语言模型（如 GPT-4o, Claude 等）高度理解并精准执行。避免泛泛而谈，根据 Agent 的具体定位给出高度定制化的指令。
4. 约束：请直接输出生成的系统提示词内容，不要包含任何额外的引导语或 markdown 代码块包裹（即不要带 \`\`\`markdown 开头和 \`\`\` 结尾，直接返回提示词正文本身）。`;

    // ---- 6. 调用 LLM 进行生成 ----
    const response = await generateText({
      model,
      prompt: promptText,
      temperature: 0.7,
    });

    const generatedPrompt = response.text.trim();

    return Response.json({ systemPrompt: generatedPrompt });
  } catch (error) {
    console.error("[Generate Prompt API] Error:", error);
    return Response.json(
      { error: "生成提示词失败，请检查 API 配置或网络连接" },
      { status: 500 }
    );
  }
}
