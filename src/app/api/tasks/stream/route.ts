import { auth } from "@/lib/auth";
import Redis from "ioredis";

export const dynamic = "force-dynamic";

// GET /api/tasks/stream — SSE 实时任务进度推送端点
export async function GET(req: Request) {
  // 1. 鉴权
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  // 2. 初始化一个独立的 Redis 客户端专门用于 Pub/Sub 订阅 (Subscribe 会阻塞连接，不能与读写共用)
  const subRedis = new Redis(redisUrl);
  const encoder = new TextEncoder();

  // 3. 构建 ReadableStream 作为响应体返回
  const stream = new ReadableStream({
    async start(controller) {
      // 订阅任务进度通道
      await subRedis.subscribe("opencat:task-progress");

      // 监听消息
      subRedis.on("message", (channel, message) => {
        try {
          const data = JSON.parse(message);
          // 仅过滤并推送当前登录用户自有的任务更新
          if (data.userId === userId) {
            controller.enqueue(
              encoder.encode(`event: task-progress\ndata: ${message}\n\n`)
            );
          }
        } catch (err) {
          console.error("解析 Redis 订阅进度消息失败:", err);
        }
      });

      // 4. 定时心跳包 (防止 Nginx 或 Gateway 代理超时断开)
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: {}\n\n`));
        } catch (err) {
          // 如果连接已断开，在此捕获并清理
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      // 5. 优雅释放资源：监听客户端连接关闭事件 (例如用户关闭网页/断开连接)
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        subRedis.unsubscribe("opencat:task-progress");
        subRedis.quit();
        try {
          controller.close();
        } catch (e) {}
      });
    },
    cancel() {
      // 保证在 Stream 被 cancel 时也释放连接
      subRedis.unsubscribe("opencat:task-progress");
      subRedis.quit();
    },
  });

  // 返回流式响应，设置 SSE 专用 Headers
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
