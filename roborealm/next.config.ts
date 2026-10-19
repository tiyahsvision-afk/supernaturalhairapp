import type { NextConfig } from "next";

const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

const nextConfig: NextConfig = STATIC
  ? // Single-page static build with relative asset URLs (see scripts/build-static.mjs).
    { reactStrictMode: true, output: "export", assetPrefix: "/__RR__", images: { unoptimized: true } }
  : {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
