import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@skribbl/shared"],
  // Hostnames only (see Next.js `allowedDevOrigins`). Add your LAN IP when testing from phones/tablets.
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.121"],
};

export default nextConfig;
