import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://mytoolpage.com/sitemap.xml",
    host: "https://mytoolpage.com",
  };
}
