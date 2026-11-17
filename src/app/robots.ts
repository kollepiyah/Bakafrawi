import type { MetadataRoute } from "next";
import { situs } from "@/content/situs";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${situs.urlSitus}/sitemap.xml` };
}
