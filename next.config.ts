import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Gambar yang diunggah dari panel admin disimpan di Supabase Storage (bucket publik `media`).
  images: { remotePatterns: [new URL("https://*.supabase.co/storage/v1/object/public/media/**")] },
  partialPrefetching: true,
  turbopack: {
    // D:\Aplikasi Project punya package-lock.json sendiri; kunci akar ke repo ini.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
