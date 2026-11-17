import type { MetadataRoute } from "next";
import { ambilKonten } from "@/lib/konten";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const situs = await ambilKonten();
  return [{ url: situs.urlSitus, changeFrequency: "monthly", priority: 1 }];
}
