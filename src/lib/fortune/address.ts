import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FortuneLocation } from "./types";
import { FORTUNE_LOCATIONS } from "./locations";

export type AddressLevel = "province" | "city" | "district" | "street";

export interface RawAddressDistrict {
  citycode?: string | string[];
  adcode?: string;
  name?: string;
  center?: string;
  level?: AddressLevel | string;
  districts?: RawAddressDistrict[];
}

export interface FortuneAddressResult extends FortuneLocation {
  id: string;
  adcode: string;
  name: string;
  province?: string;
  city?: string;
  district?: string;
  level: AddressLevel;
}

let cachedAddressTree: RawAddressDistrict[] | null = null;
let cachedAddressLoadFailed = false;

const ADDRESS_JSON_PATHS = [
  path.join(process.cwd(), "tools", "address.json"),
  path.join(process.cwd(), "src", "lib", "tools", "address.json"),
];
const CHINA_TIMEZONE = "Asia/Shanghai";

export async function searchFortuneAddressFile(query: string, limit = 30): Promise<FortuneAddressResult[]> {
  const tree = await loadAddressTree();
  if (tree.length === 0) {
    return searchFallbackLocations(query, limit);
  }
  return searchFortuneAddresses(tree, query, limit);
}

export function searchFortuneAddresses(
  tree: RawAddressDistrict[],
  query: string,
  limit = 30
): FortuneAddressResult[] {
  const normalizedQuery = normalizeSearchText(query);
  const allResults = flattenAddressDistricts(tree);

  if (!normalizedQuery) {
    return allResults.slice(0, clampLimit(limit));
  }

  return allResults
    .map((result) => ({
      result,
      score: scoreAddressResult(result, normalizedQuery),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || levelRank(b.result.level) - levelRank(a.result.level))
    .slice(0, clampLimit(limit))
    .map((item) => item.result);
}

export function flattenAddressDistricts(tree: RawAddressDistrict[]): FortuneAddressResult[] {
  const results: FortuneAddressResult[] = [];

  for (const provinceNode of tree) {
    visitAddressNode(provinceNode, {}, results);
  }

  return results;
}

function visitAddressNode(
  node: RawAddressDistrict,
  pathParts: { province?: string; city?: string; district?: string },
  results: FortuneAddressResult[]
) {
  if (!node.name || !node.adcode || !node.center) return;

  const level = normalizeAddressLevel(node.level);
  const nextPath = nextAddressPath(pathParts, level, node.name);
  const coordinate = parseCenter(node.center);

  if (coordinate) {
    results.push({
      id: node.adcode,
      adcode: node.adcode,
      name: [nextPath.province, nextPath.city, nextPath.district].filter(Boolean).join(" "),
      province: nextPath.province,
      city: nextPath.city,
      district: nextPath.district,
      longitude: coordinate.longitude,
      latitude: coordinate.latitude,
      timezone: CHINA_TIMEZONE,
      level,
    });
  }

  for (const child of node.districts || []) {
    visitAddressNode(child, nextPath, results);
  }
}

async function loadAddressTree(): Promise<RawAddressDistrict[]> {
  if (cachedAddressTree) return cachedAddressTree;
  if (cachedAddressLoadFailed) return [];

  for (const addressPath of ADDRESS_JSON_PATHS) {
    try {
      const raw = await readFile(addressPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      cachedAddressTree = Array.isArray(parsed) ? (parsed as RawAddressDistrict[]) : [];
      return cachedAddressTree;
    } catch (error) {
      if (isMissingFileError(error)) continue;
      cachedAddressLoadFailed = true;
      console.warn(`[fortune.address] Failed to load ${addressPath}`, error);
      return [];
    }
  }

  cachedAddressLoadFailed = true;
  console.warn("[fortune.address] No address.json found in tools/address.json or src/lib/tools/address.json");
  return [];
}

function searchFallbackLocations(query: string, limit: number): FortuneAddressResult[] {
  const normalizedQuery = normalizeSearchText(query);
  return FORTUNE_LOCATIONS.filter((location) => {
    if (!normalizedQuery) return true;
    return normalizeSearchText(location.name).includes(normalizedQuery);
  })
    .slice(0, clampLimit(limit))
    .map((location) => ({
      ...location,
      id: location.id || location.name,
      adcode: location.id || location.name,
      level: "city",
    }));
}

function nextAddressPath(
  pathParts: { province?: string; city?: string; district?: string },
  level: AddressLevel,
  name: string
) {
  if (level === "province") return { province: name };
  if (level === "city") return { province: pathParts.province, city: name };
  return {
    province: pathParts.province,
    city: pathParts.city,
    district: name,
  };
}

function parseCenter(center: string) {
  const [longitudeText, latitudeText] = center.split(",");
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
  return { longitude, latitude };
}

function scoreAddressResult(result: FortuneAddressResult, normalizedQuery: string) {
  const compactName = normalizeSearchText(result.name);
  const compactParts = normalizeSearchText(
    `${result.province || ""}${result.city || ""}${result.district || ""}${result.adcode}`
  );
  const directName = normalizeSearchText(result.district || result.city || result.province || result.name);
  const looseName = loosenAdministrativeSuffixes(compactName);
  const looseParts = loosenAdministrativeSuffixes(compactParts);
  const looseQuery = loosenAdministrativeSuffixes(normalizedQuery);

  if (compactName === normalizedQuery || compactParts === normalizedQuery) return 1000;
  if (directName === normalizedQuery) return 900;
  if (
    compactName.includes(normalizedQuery) ||
    compactParts.includes(normalizedQuery) ||
    looseName.includes(looseQuery) ||
    looseParts.includes(looseQuery)
  ) {
    return 500 + Math.min(normalizedQuery.length, 100) + levelRank(result.level);
  }
  if (normalizedQuery.includes(directName) && directName.length >= 2) return 300 + directName.length;
  return 0;
}

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

function loosenAdministrativeSuffixes(value: string) {
  return value.replace(/[省市区县旗盟州]/g, "");
}

function normalizeAddressLevel(level: RawAddressDistrict["level"]): AddressLevel {
  if (level === "province" || level === "city" || level === "district" || level === "street") return level;
  return "district";
}

function levelRank(level: AddressLevel) {
  if (level === "district") return 3;
  if (level === "city") return 2;
  if (level === "province") return 1;
  return 0;
}

function clampLimit(limit: number) {
  if (!Number.isFinite(limit)) return 30;
  return Math.min(Math.max(Math.floor(limit), 1), 50);
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
