import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Smaller production images (see Dockerfile.prd)
  output: "standalone",
};

export default nextConfig;
