// ============================================================
// Tool Registry — 工具注册中心（Day 4 核心）
// ============================================================
//
// 什么是 Tool Registry？
// ---
// 就是一个「工具仓库」，所有可用的工具都在这里注册和管理。
// 类似于你玩游戏时的背包系统——所有装备（工具）都放在背包里，
// 需要用的时候从背包里拿出来。
//
// 为什么需要注册中心？
// ---
// 1. 统一管理：内置工具、HTTP 工具、MCP 工具都在一个地方注册
// 2. 按需取用：Agent 可以根据配置选择启用哪些工具
// 3. 类型转换：将我们的 ToolDefinition 转换成 AI SDK 需要的格式
// 4. 面试亮点：体现「注册表模式」的架构设计能力
//
// 核心流程：
//   注册工具 → 按名字查找 → 转换成 AI SDK 格式 → 传给 streamText()
//
// ============================================================

import type { ToolSet } from "ai";
import type { ToolDefinition, ToolExecutionContext, RegisteredTool } from "./types";
import { calculatorTool, datetimeTool, httpRequestTool, memorySaveTool, memorySearchTool } from "./builtin";

// ---------- 注册中心类 ----------
// 用 class 实现，方便管理状态（存储已注册的工具）
// 用单例模式确保全局只有一个注册中心实例
class ToolRegistry {
  // 用 Map 存储工具：key 是工具名，value 是注册信息
  // 为什么用 Map 不用普通对象？
  // → Map 的 key 支持任意类型（虽然这里是 string）
  // → Map 有 size 属性、forEach 等便捷方法
  // → Map 的迭代顺序是插入顺序（普通对象也是，但 Map 更明确）
  private tools: Map<string, RegisteredTool> = new Map();

  // ---------- 注册单个工具 ----------
  register(definition: ToolDefinition, type: "builtin" | "http" | "mcp" = "builtin"): void {
    this.tools.set(definition.name, {
      definition,
      type,
      enabled: true,
    });
  }

  // ---------- 注销工具 ----------
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  // ---------- 按名字获取工具 ----------
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  // ---------- 获取所有已注册的工具 ----------
  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  // ---------- 获取所有已启用的工具名列表 ----------
  getEnabledNames(): string[] {
    return Array.from(this.tools.entries())
      .filter(([, t]) => t.enabled)
      .map(([name]) => name);
  }

  // ---------- 启用/禁用工具 ----------
  setEnabled(name: string, enabled: boolean): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;
    tool.enabled = enabled;
    return true;
  }

  // ============================================================
  // 核心方法：转换成 AI SDK 的 ToolSet 格式
  // ============================================================
  //
  // 这是 Day 4 最关键的方法！
  //
  // 做的事情：
  //   我们的 ToolDefinition[] → AI SDK 的 ToolSet（Record<string, Tool>）
  //
  // AI SDK 的 streamText() 需要的 tools 参数格式：
  //   {
  //     calculator: tool({ description, parameters, execute }),
  //     datetime:   tool({ description, parameters, execute }),
  //   }
  //
  // 其中 tool() 是 AI SDK 提供的工厂函数（import { tool } from "ai"）
  // tool() 的作用很简单：它只是原样返回传入的对象（相当于类型标记器）
  // 但它确保了传入的对象符合 AI SDK 的 Tool 接口
  //
  // 参数说明：
  //   toolNames: 要使用的工具名列表。如果不传，使用所有已启用的工具
  //   context: 执行上下文（userId 等），会传给工具的 execute 函数
  //
  toAISDKTools(
    context: ToolExecutionContext,
    toolNames?: string[]
  ): ToolSet {
    // 确定要使用哪些工具
    const names = toolNames ?? this.getEnabledNames();

    // 构造 AI SDK 格式的 ToolSet
    const toolSet: ToolSet = {};

    for (const name of names) {
      const registered = this.tools.get(name);

      // 跳过不存在或未启用的工具
      if (!registered || !registered.enabled) continue;

      const def = registered.definition;

      // 将我们的 ToolDefinition 转成 AI SDK 的 Tool 格式
      //
      // AI SDK 的 tool() 本质上是个 identity function（原样返回），
      // 但它的 TypeScript 重载类型很严格，在我们的泛型架构下会报类型错误。
      //
      // 解决方案：直接构造 AI SDK 需要的对象结构，跳过 tool() 函数。
      // 这完全合法，因为 tool() 不做任何转换，只是类型标记。
      // streamText() 的 tools 参数接受 ToolSet = Record<string, Tool>
      //
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (toolSet as Record<string, any>)[name] = {
        description: def.description,
        parameters: def.parameters,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        execute: async (input: any) => {
          const result = await def.execute(input, context);
          return result;
        },
      };
    }

    return toolSet;
  }
}

// ============================================================
// 单例 + 内置工具自动注册
// ============================================================
//
// 创建全局唯一的注册中心实例
// 在模块加载时自动注册所有内置工具
//
// 为什么用单例？
// → 整个应用只需要一个工具仓库
// → 避免每次请求都重复创建和注册
// → Node.js 的模块缓存机制保证 import 多次也只执行一次

const registry = new ToolRegistry();

// 自动注册内置工具
registry.register(calculatorTool, "builtin");
registry.register(datetimeTool, "builtin");
registry.register(httpRequestTool, "builtin");
registry.register(memorySaveTool, "builtin");
registry.register(memorySearchTool, "builtin");

// 导出单例
export { registry as toolRegistry };

// 也导出类本身，方便测试时创建独立实例
export { ToolRegistry };
