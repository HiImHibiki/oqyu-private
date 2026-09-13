import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  // Berkas prompt dibaca dari disk saat runtime, jadi harus ikut terbawa
  // ke bundel serverless — kalau tidak, tombol generate mati di produksi.
  outputFileTracingIncludes: {
    "/api/admin/ai/**": ["./prompts/**/*"],
  },
};

export default nextConfig;
