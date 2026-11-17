import type { MetadataRoute } from "next";
import { situs } from "@/content/situs";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: situs.urlSitus, changeFrequency: "monthly", priority: 1 }];
}
