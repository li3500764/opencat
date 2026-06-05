import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { deleteImageGenerationTaskAssets } from "@/lib/images/task-runner";

const backgroundTaskDb = db as typeof db & {
  backgroundTask: {
    findUnique: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
};

// DELETE — 删除特定的后台长任务
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. 验证用户登录状态
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // 2. 查询对应的任务，并关联查询项目以判断归属权
    const task = await backgroundTaskDb.backgroundTask.findUnique({
      where: { id },
      include: {
        project: true,
      },
    }) as { id: string; type: string; details: string | null; project: { userId: string } } | null;

    if (!task) {
      return Response.json({ error: "任务不存在" }, { status: 404 });
    }

    // 3. 校验该任务所属的项目是否归属于当前登录用户
    if (task.project.userId !== session.user.id) {
      return Response.json({ error: "无权访问此任务" }, { status: 403 });
    }

    if (task.type === "image-generation") {
      await deleteImageGenerationTaskAssets(task.details);
    }

    // 4. 执行物理删除
    await backgroundTaskDb.backgroundTask.delete({
      where: { id },
    });

    return Response.json({ success: true, message: "任务删除成功" });
  } catch (err) {
    console.error("删除任务失败:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "删除任务失败" },
      { status: 500 }
    );
  }
}
