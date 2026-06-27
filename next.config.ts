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
  /* 서버 액션 용량 제한 (25MB) — 전사 음성 업로드용. Whisper API 자체 상한이 25MB라
     그에 맞춤. 저비트레이트(32kbps) 녹음과 합쳐 90분 이상도 안전하게 커버. */
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;