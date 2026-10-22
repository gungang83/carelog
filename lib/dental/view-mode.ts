// 치아 화면(치아 그림·치간칫솔 차트) 2D/3D 마지막 선택 — 화면마다 따로 기억(브라우저 저장, 실패해도 2D로 동작).
export type ViewMode = "2d" | "3d";

export function readViewMode(key: string): ViewMode {
  try {
    return localStorage.getItem(key) === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

export function writeViewMode(key: string, mode: ViewMode) {
  try {
    localStorage.setItem(key, mode);
  } catch {
    // 저장 못 해도 이번 사용에는 지장 없음
  }
}
