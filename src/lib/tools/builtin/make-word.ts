// ============================================================
// 内置工具：制作 Word 文档（make_word）
// ============================================================
//
// 功能：生成可直接被 Microsoft Word 解析并二次编辑的 .doc 格式电子文档
//
// ============================================================

import { z } from "zod";
import type { ToolDefinition } from "../types";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const makeWordSchema = z.object({
  title: z.string().describe("Word 文件标题，例如 '员工劳动聘用合同范本'"),
  content: z.string().describe("Word 文件的段落与正文文本内容"),
  author: z.string().default("OpenCat AI").describe("文档作者/编辑部门署名"),
});

type MakeWordInput = z.infer<typeof makeWordSchema>;

export const makeWordTool: ToolDefinition<MakeWordInput> = {
  name: "make_word",
  description: "制作并生成 Microsoft Word 电子文档。输入标题、正文及作者信息，工具会自动生成符合 Office 标准的 .doc 后缀文档下载链接。",
  parameters: makeWordSchema,
  execute: async (input, _context) => {
    try {
      const downloadDir = path.join(process.cwd(), "public", "downloads");
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      const fileId = nanoid(8);
      const fileName = `doc-${fileId}.doc`; // 完美兼容 Word 打开的 .doc 后缀
      const filePath = path.join(downloadDir, fileName);

      // 利用 Microsoft Office HTML w:word 规范，双击完美以 Word 经典版面开启
      const wordHtml = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${input.title}</title>
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; padding: 40px; line-height: 1.6; }
    h1 { text-align: center; color: #1e293b; font-size: 26px; font-weight: bold; margin-bottom: 12px; }
    .meta { text-align: right; font-size: 11px; color: #64748b; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    p { text-indent: 2em; margin-bottom: 12px; font-size: 14px; text-align: justify; color: #334155; }
  </style>
</head>
<body>
  <h1>${input.title}</h1>
  <div class="meta">署名作者: ${input.author} &nbsp;|&nbsp; 智能制作时间: ${new Date().toLocaleDateString()}</div>
  <div>
    ${input.content.split("\n").map(p => p.trim() ? `<p>${p.trim()}</p>` : "").join("")}
  </div>
</body>
</html>
      `;

      fs.writeFileSync(filePath, wordHtml, "utf-8");

      return {
        success: true,
        data: {
          title: input.title,
          fileName,
          downloadUrl: `/api/downloads/${fileName}`,
          message: "Microsoft Word (.doc) 格式电子书信文档制作成功！您可以点击下方链接下载，双击即可直接在 Office 中编辑。",
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `生成 Word 失败: ${err instanceof Error ? err.message : "未知错误"}`,
      };
    }
  },
};
