// ============================================================
// 内置工具：生成图片（image_generation）
// ============================================================
//
// 功能：使用 AI 模型（DALL-E 格式）根据文本描述生成图片
//
// 运作流程：
// 1. 获取调用此工具用户的 API 密钥（优先从数据库加载 OpenAI 密钥，其次是 custom，最后是环境变量）
// 2. 构造符合 OpenAI /images/generations 规范的请求体
// 3. 发送异步 POST 请求并解析返回的图片 URL
// 4. 返回标准结构数据，大模型可在接收到后通过 markdown 标签渲染在聊天窗中
// ============================================================

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { db } from "@/server/db";
import { decrypt } from "@/lib/crypto";

// ---------- 参数 Schema ----------
const imageGenerationSchema = z.object({
  // 生图提示词
  prompt: z
    .string()
    .describe("对要生成的图片的详细描述（建议使用详细的英文描述以获得最佳生成效果）。例如：'A cute orange cat wearing a space helmet, digital art'"),

  // 选择生图模型
  model: z
    .string()
    .default("dall-e-3")
    .describe("用于生成图片的模型。支持官方的 dall-e-3、dall-e-2，或自定义第三方代理生图模型名称（如 gpt-image-2 等）"),

  // 图片分辨率
  size: z
    .enum(["256x256", "512x512", "1024x1024", "1024x1792", "1792x1024"])
    .default("1024x1024")
    .describe("生成的图片分辨率，DALL-E 3 仅支持 1024x1024、1024x1792、1792x1024，DALL-E 2 支持所有分辨率"),

  // 图片质量 (仅 DALL-E 3)
  quality: z
    .enum(["standard", "hd"])
    .optional()
    .describe("图片质量：standard（标准）或 hd（高清），仅适用于 dall-e-3"),

  // 图片风格 (仅 DALL-E 3)
  style: z
    .enum(["vivid", "natural"])
    .optional()
    .describe("图片风格：vivid（生动、艺术感强）或 natural（自然、写实感强），仅适用于 dall-e-3"),
});

type ImageGenerationInput = z.infer<typeof imageGenerationSchema>;

// ---------- 导出工具定义 ----------
export const imageGenerationTool: ToolDefinition<ImageGenerationInput> = {
  name: "image_generation",

  description:
    "根据文本描述智能生成图片（AI 画图）。支持选择生成模型、设定图片比例/分辨率、选择质量与艺术风格。" +
    "当用户明确表示需要「画图」、「生图」、「生成图片」、「设计海报」等视觉图像创作需求时，必须调用此工具。" +
    "【重要】在调用成功后，你必须在最终回复中以标准的 Markdown 语法将返回的 url 渲染出来，例如 `![Generated Image](图片URL)`，否则用户无法看到图片。",

  parameters: imageGenerationSchema,

  execute: async (input, context) => {
    try {
      const { userId } = context;
      let apiKey: string | null = null;
      let baseUrl: string | undefined;
      let apiKeyModels: unknown = null;

      // 1. 根据 userId 查找数据库中配置的 API 密钥
      if (userId) {
        // 第一轮：精确查找 provider="openai" 的有效 Key
        let userKey = await db.apiKey.findFirst({
          where: { userId, provider: "openai", isActive: true },
        });

        // 第二轮：如果没有配置专用 openai，则寻找自定义 custom（可能是中转代理）
        if (!userKey) {
          userKey = await db.apiKey.findFirst({
            where: { userId, provider: "custom", isActive: true },
          });
        }

        if (userKey) {
          apiKey = decrypt(userKey.encryptedKey, userKey.iv);
          baseUrl = userKey.baseUrl || undefined;
          apiKeyModels = userKey.models;
        }
      }

      // 2. 第三轮：回退读取系统环境变量
      if (!apiKey) {
        apiKey = process.env.OPENAI_API_KEY || null;
        baseUrl = process.env.OPENAI_API_BASE || undefined;
      }

      // 如果未配置任何密钥，则拒绝服务
      if (!apiKey) {
        return {
          success: false,
          error: "未能在您的账户或系统配置中找到有效的 OpenAI 密钥。请先前往「设置 (Settings) -> API 密钥」配置 OpenAI 或自定义类型的 API Key。",
        };
      }

      // 规范化接口基准地址（支持自动补齐 /v1 后缀，以防中转接口因缺失 /v1 导致生图请求 404）
      let apiBase = "https://api.openai.com/v1";
      if (baseUrl) {
        const cleanUrl = baseUrl.replace(/\/$/, "");
        if (!cleanUrl.endsWith("/v1") && !cleanUrl.includes("/v1/")) {
          apiBase = `${cleanUrl}/v1`;
        } else {
          apiBase = cleanUrl;
        }
      }

      let requestModel = input.model || "dall-e-3";

      // 3.1 自动适配第三方中转代理已配置的模型（无硬编码，由配置数据驱动）
      if (apiKeyModels) {
        try {
          const customModels = (apiKeyModels as unknown as { id: string }[]) || [];
          if (customModels.length > 0) {
            // 检查请求的模型是否在用户配置的 models 列表中（忽略大小写）
            const hasRequestedModel = customModels.some(
              (m) => m.id.toLowerCase() === requestModel.toLowerCase()
            );

            // 如果配置列表里没有当前请求的模型（比如不支持 dall-e-3），则启动智能重映射
            if (!hasRequestedModel) {
              // 1. 优先寻找名称中带有生图特征的模型（如包含 image, dall, midjourney, mj, flux, sd 等关键字）
              const imageKeywords = ["image", "dall", "midjourney", "mj", "flux", "sd"];
              const matchedModel = customModels.find((m) =>
                imageKeywords.some((kw) => m.id.toLowerCase().includes(kw))
              );

              if (matchedModel) {
                requestModel = matchedModel.id;
              } else {
                // 2. 如果没找到含生图关键字的模型，直接回退使用该 Key 下配置的第一个模型（在专门用于生图的 API Key 中，列表里通常只包含该生图模型）
                requestModel = customModels[0].id;
              }
            }
          }
        } catch (e) {
          console.error("解析 API Key 模型列表失败，跳过重映射:", e);
        }
      }

      // 3. 调用 OpenAI 图片生成 API
      const response = await fetch(`${apiBase}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: input.prompt,
          model: requestModel,
          n: 1, // DALL-E 3 仅支持 n=1，此处统一默认为 1
          size: input.size,
          quality: input.quality,
          style: input.style,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;
        return {
          success: false,
          error: `API 请求生图失败: ${errorMessage}`,
        };
      }

      const resData = await response.json();

      // 4. 验证图片 URL 数据返回格式
      if (!resData.data || !resData.data[0] || !resData.data[0].url) {
        return {
          success: false,
          error: "生图接口返回的数据为空或格式不正确，未能解析到图片地址。",
        };
      }

      return {
        success: true,
        data: {
          url: resData.data[0].url,
          markdown: `![Generated Image](${resData.data[0].url})`,
          revised_prompt: resData.data[0].revised_prompt || "",
          raw: resData,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `生图工具执行异常: ${err instanceof Error ? err.message : "未知错误"}`,
      };
    }
  },
};
