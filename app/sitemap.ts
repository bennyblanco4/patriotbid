import type { MetadataRoute } from "next";
import { supplyGroups } from "./fsc";
import { guides } from "./guides/content";
import type { PartInfo } from "../lib/parts";
import { todayEt } from "../lib/opportunities";
import { groupCounts, listedParts } from "../lib/store";

const BASE = "https://bidprospect.com";
export const revalidate = 3600;

// Categories with saved requests, and NSN pages that have supplier or award
// details (the others are noindex until their PDF has been read).
async function dataPages(): Promise<MetadataRoute.Sitemap> {
  try {
    const counts = await groupCounts(todayEt());
    const categories = supplyGroups
      .filter((group) => (counts.get(group.code)?.total ?? 0) > 0)
      .map((group) => ({
        url: `${BASE}/category/${group.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.6,
      }));
    const nsns = (await listedParts())
      .filter(({ data }) => {
        const part = data as PartInfo;
        return (part.sources?.length ?? 0) > 0 || (part.awards?.length ?? 0) > 0;
      })
      .map(({ nsn, checkedAt }) => ({
        url: `${BASE}/nsn/${nsn}`,
        lastModified: checkedAt,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }));
    return [...categories, ...nsns];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/category`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/guides`, changeFrequency: "monthly", priority: 0.6 },
    ...guides.map((guide) => ({
      url: `${BASE}/guides/${guide.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...(await dataPages()),
  ];
}
