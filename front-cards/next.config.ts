import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Smaller production images (see Dockerfile.prod)
  output: "standalone",
};

export default nextConfig;
