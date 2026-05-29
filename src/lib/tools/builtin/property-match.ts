import { z } from "zod";
import type { ToolDefinition } from "../types";

export const propertyMatchTool: ToolDefinition = {
  name: "property_match",
  description: "根据客户的行业、规模、预算等需求，从园区房源库中智能匹配最合适的楼层和房间，主要用于招商顾问分身。",
  parameters: z.object({
    industry: z.string().describe("客户行业"),
    teamSize: z.number().describe("团队规模（人数）"),
    budget: z.number().describe("月度预算上限(元)"),
    requirements: z.string().optional().describe("特殊需求，如朝向、采光、是否需要定制装修")
  }),
  execute: async (args, context) => {
    // 模拟数据查询
    const properties = [
      { id: "A1-502", building: "A1栋", floor: 5, size: "300平米", price: 25000, type: "精装", tags: ["朝南", "采光好", "互联网氛围"] },
      { id: "B2-1201", building: "B2栋", floor: 12, size: "500平米", price: 35000, type: "毛坯", tags: ["高层视野", "可定制", "独立新风"] },
      { id: "C3-305", building: "C3栋", floor: 3, size: "150平米", price: 12000, type: "简装", tags: ["近地铁", "低成本", "初创优选"] }
    ];

    // 简单模拟匹配逻辑
    let matched = properties;
    if (args.budget && args.budget < 15000) {
      matched = matched.filter(p => p.price <= args.budget);
    } else if (args.teamSize && args.teamSize > 30) {
      matched = matched.filter(p => parseInt(p.size) >= 300);
    }

    if (matched.length === 0) {
      return { 
        status: "success", 
        message: "抱歉，目前没有完全匹配您预算和规模的房源，但我为您推荐了最接近的选项。", 
        recommendations: properties.slice(0, 1) 
      };
    }

    return {
      status: "success",
      message: `为您匹配到 ${matched.length} 套合适的房源。`,
      recommendations: matched
    };
  }
};
