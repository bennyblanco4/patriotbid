import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://bidprospect.com",
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://bidprospect.com/dashboard",
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}
