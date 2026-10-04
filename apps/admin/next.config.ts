import type { NextConfig } from "next";

import { securityHeadersConfig } from "../../packages/shared/src/security-headers";

const nextConfig: NextConfig = {
  headers: securityHeadersConfig,
};

export default nextConfig;
