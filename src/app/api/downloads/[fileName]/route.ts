import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// ============================================================
// 文件下载与预览服务接口 (用于接管并解决 404 静态路径加载问题)
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> | { fileName: string } }
) {
  try {
    // 兼容 Next.js 不同的路由参数解析方式 (App Router 规范)
    const resolvedParams = await (params instanceof Promise ? params : Promise.resolve(params));
    const { fileName } = resolvedParams;
    
    // 定位本地公共 downloads 文件夹的文件路径
    const filePath = path.join(process.cwd(), "public", "downloads", fileName);

    // 校验文件是否存在
    if (!fs.existsSync(filePath)) {
      return new NextResponse("抱歉，您访问的文件未找到或已被系统清理", { status: 404 });
    }

    // 读取本地文件二进制数据
    const fileBuffer = fs.readFileSync(filePath);

    // 匹配不同的文件类型以指定正确的 Content-Type 响应头
    let contentType = "application/octet-stream";
    if (fileName.endsWith(".html")) {
      contentType = "text/html; charset=utf-8";
    } else if (fileName.endsWith(".doc")) {
      contentType = "application/msword";
    } else if (fileName.endsWith(".xls")) {
      contentType = "application/vnd.ms-excel";
    }

    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };

    // 非 HTML 的文档类型一律以附件下载形式呈现，确保在大部分浏览器上触发保存
    if (!fileName.endsWith(".html")) {
      headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(fileName)}"`;
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    return new NextResponse(
      `读取文件时服务器发生内部错误: ${error instanceof Error ? error.message : "未知错误"}`,
      { status: 500 }
    );
  }
}
