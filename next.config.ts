import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the same Wi-Fi load dev assets and HMR via the Mac's LAN IP.
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
