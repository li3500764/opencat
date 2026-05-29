import { NextResponse } from "next/server";
import { z } from "zod";

// 统一的 API 响应格式
export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
};

/**
 * 统一成功响应包装器
 * @param data 响应数据
 * @param status HTTP 状态码，默认 200
 */
export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * 统一错误响应包装器
 * @param message 错误信息提示
 * @param status HTTP 状态码，默认 400
 * @param code 内部错误码 (可选)
 */
export function apiError(message: string, status = 400, code?: string) {
  return NextResponse.json<ApiResponse>(
    {
      success: false,
      error: {
        message,
        code,
      },
    },
    { status }
  );
}

/**
 * 运行时 Zod 请求体解析与校验器
 * 如果请求体格式有误或不满足 schema，会自动抛出格式化的 ZodError
 * @param schema Zod 校验 Schema
 * @param req Request 请求对象
 */
export async function validateBody<T>(schema: z.Schema<T>, req: Request): Promise<T> {
  try {
    const json = await req.json();
    return schema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // 提取有意义的错误消息
      const details = error.issues
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      throw new Error(`输入数据验证失败: ${details}`);
    }
    throw new Error("无效的 JSON 请求体");
  }
}
