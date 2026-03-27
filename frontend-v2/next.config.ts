import type { NextConfig } from "next";
import type  withBundleAnalyzer  from "@next/bundle-analyzer";

const withBundleAnalyzer:any= {
  enabled: process.env.ANALYZE === "true",
};

const nextConfig:NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },
};

export default  withBundleAnalyzer(nextConfig);