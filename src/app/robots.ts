import type { MetadataRoute } from "next";
import { ambilKonten } from "@/lib/konten";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const situs = await ambilKonten();
  return { rules: { userAgent: "*", allow: "/", disallow: "/admin" }, sitemap: `${situs.urlSitus}/sitemap.xml` };
}
