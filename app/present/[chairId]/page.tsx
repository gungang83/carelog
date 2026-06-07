import type { Metadata } from "next";
import PresentScreen from "@/components/chair/present-screen";

export const metadata: Metadata = {
  title: "Carelog — 진료 안내",
  // 환자 모니터 표시 전용 화면 — 검색엔진 비노출
  robots: { index: false, follow: false },
};

// 체어 모니터에 띄우는 환자용 "빠른 녹음" 설명화면.
// 로그인 불요(미들웨어 공개 경로). Next 16 — params는 Promise.
export default async function PresentPage({
  params,
}: {
  params: Promise<{ chairId: string }>;
}) {
  const { chairId } = await params;
  return <PresentScreen chairId={chairId} />;
}
