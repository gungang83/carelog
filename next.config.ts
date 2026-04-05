import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 기존 이미지 허용 설정 */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  /* 서버 액션 용량 제한 해제 설정 (10MB) */
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;