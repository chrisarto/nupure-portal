import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['html-pdf-node', 'puppeteer-core'],
};

export default nextConfig;
