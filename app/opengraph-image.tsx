import { ImageResponse } from "next/og";

// 링크 미리보기(문자·카톡) 썸네일 — 없으면 Next 기본 favicon(삼각형)이 뜬다.
// 기본 폰트는 라틴만 지원하므로 한글 없이 브랜드 마크만 그린다(병원명은 페이지 title이 담당).
export const alt = "Carelog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          background: "linear-gradient(135deg, #e0f2fe 0%, #ffffff 55%, #e0f2fe 100%)",
        }}
      >
        <div
          style={{
            width: 240,
            height: 240,
            borderRadius: 56,
            background: "#0284c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 170,
            fontWeight: 700,
          }}
        >
          C
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 120, fontWeight: 700, color: "#0c4a6e" }}>Carelog</div>
          <div style={{ fontSize: 40, color: "#0369a1", marginTop: 8 }}>Dental consultation notes</div>
        </div>
      </div>
    ),
    size,
  );
}
