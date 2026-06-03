// ============================================================
// 内置工具：制作 Excel 表格（make_excel）
// ============================================================
//
// 功能：生成包含多 Sheet、带完整网格线、数据自动对齐的高保真 .xls 电子表格文件
//
// ============================================================

import { z } from "zod";
import type { ToolDefinition } from "../types";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const makeExcelSchema = z.object({
  title: z.string().describe("Excel 工作簿的全局标题，例如 '公司2026年第二季度财务报表'"),
  sheets: z.array(
    z.object({
      sheetName: z.string().describe("标签页名称，例如 '收入明细', '人员名单'"),
      headers: z.array(z.string()).describe("表头列名数组，例如 ['日期', '项目', '金额']"),
      rows: z.array(z.array(z.any())).describe("二维数据行数组，每一行必须与表头列数一一对应。例如 [['2026-06-01', '软件采购', 5000]]")
    })
  ).describe("工作表 Sheet 列表，支持多个标签页")
});

type MakeExcelInput = z.infer<typeof makeExcelSchema>;

export const makeExcelTool: ToolDefinition<MakeExcelInput> = {
  name: "make_excel",
  description: "制作并生成 Microsoft Excel 电子表格。输入标题、多个标签页(Sheet)的表头和二维数组数据，工具会自动完成格式对齐排版并生成带网格线的 .xls 表格文件下载链接。",
  parameters: makeExcelSchema,
  execute: async (input, _context) => {
    try {
      const downloadDir = path.join(process.cwd(), "public", "downloads");
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      const fileId = nanoid(8);
      const fileName = `excel-${fileId}.xls`; // 利用 .xls 完美向下兼容
      const filePath = path.join(downloadDir, fileName);

      let sheetListXml = "";
      let sheetsContentHtml = "";

      input.sheets.forEach((sheet, index) => {
        const sName = sheet.sheetName || `Sheet${index + 1}`;
        const safeSheetName = sName.replace(/["'&<>]/g, "");

        // 1. 注册工作簿中的 Sheet，以便 Excel 能识别标签页切换
        sheetListXml += `
        <x:ExcelWorksheet>
          <x:Name>${safeSheetName}</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
        `;

        // 2. 构造表格 HTML 数据
        let tableRowsHtml = "";
        
        // 渲染表头
        tableRowsHtml += "<tr>";
        sheet.headers.forEach(h => {
          const safeH = String(h).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          tableRowsHtml += `<th>${safeH}</th>`;
        });
        tableRowsHtml += "</tr>";

        // 渲染数据行
        sheet.rows.forEach(row => {
          tableRowsHtml += "<tr>";
          row.forEach(val => {
            const strVal = val === null || val === undefined ? "" : String(val);
            // 简单判断是否是纯数值（方便右对齐并保留千分位格式）
            const isNum = typeof val === "number" || (!isNaN(Number(val)) && val.trim() !== "");
            const safeVal = strVal.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            if (isNum) {
              tableRowsHtml += `<td class="number">${safeVal}</td>`;
            } else {
              tableRowsHtml += `<td class="text">${safeVal}</td>`;
            }
          });
          tableRowsHtml += "</tr>";
        });

        // 拼接 Sheet 主体，注意使用 page-break-after 来给不同表格分页
        sheetsContentHtml += `
        <div style="page-break-after:always;">
          <h2 class="sheet-title">${sName}</h2>
          <table>
            <thead>
              ${tableRowsHtml.split("</tr>")[0]}</tr>
            </thead>
            <tbody>
              ${tableRowsHtml.split("</tr>").slice(1).join("</tr>")}
            </tbody>
          </table>
        </div>
        `;
      });

      // 3. 构建高精细 Excel 专属 HTML + XML 组合模板
      const excelTemplate = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:x="urn:schemas-microsoft-com:office:excel" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        ${sheetListXml}
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; padding: 20px; }
    .sheet-title { font-size: 15px; font-weight: bold; color: #1e293b; margin-top: 15px; margin-bottom: 10px; font-family: 'Microsoft YaHei', sans-serif; }
    table { border-collapse: collapse; margin-bottom: 40px; }
    th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; border: 0.5pt solid #cbd5e1; padding: 8px 12px; font-size: 11pt; text-align: center; }
    td { border: 0.5pt solid #cbd5e1; padding: 6px 10px; font-size: 10pt; font-family: 'Microsoft YaHei', Arial, sans-serif; }
    .number { text-align: right; mso-number-format: "\\#,\\#\\0.00"; }
    .text { text-align: left; mso-number-format: "\\@"; }
  </style>
</head>
<body>
  ${sheetsContentHtml}
</body>
</html>
      `.trim();

      fs.writeFileSync(filePath, excelTemplate, "utf-8");

      return {
        success: true,
        data: {
          title: input.title,
          fileName,
          downloadUrl: `/api/downloads/${fileName}`,
          message: `Microsoft Excel 表格「${input.title}」制作成功！共生成了 ${input.sheets.length} 个标签页。您可以点击下方链接下载，双击即可在 Office/WPS 中以完整网格线与高保真样式开启编辑。`,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `生成 Excel 失败: ${err instanceof Error ? err.message : "未知错误"}`,
      };
    }
  },
};
