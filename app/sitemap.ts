import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: "https://mytoolpage.com/",
    lastModified: new Date("2026-09-17T12:00:00Z"),
    changeFrequency: "daily",
    priority: 1,
  }];
}
