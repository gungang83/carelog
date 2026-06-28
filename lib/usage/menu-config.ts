// spec 013 — 메뉴(화면) 사용량 추적용 메뉴 정의.
//   RouteTracker(클라)가 라우트 첫 세그먼트를 menu_id로 track API에 보낸다.
//   track API/summary API가 화이트리스트·라벨 매핑에 공용으로 사용한다.

export interface MenuItem {
  id: string; // 라우트 첫 세그먼트('home'은 '/' 가상 id)
  label: string;
}

// 대시보드 라우트(app/(dashboard)) 기준. 새 화면 추가 시 여기에 등록.
export const MENU_ITEMS: MenuItem[] = [
  { id: "home", label: "홈" },
  { id: "records", label: "상담 기록" },
  { id: "patients", label: "환자 목록" },
  { id: "view", label: "상담 상세" },
  { id: "settings", label: "설정" },
  { id: "help", label: "도움말" },
  { id: "about", label: "서비스 소개" },
  { id: "admin", label: "슈퍼어드민" },
];

const LABEL_MAP = new Map(MENU_ITEMS.map((m) => [m.id, m.label]));
export const MENU_IDS = new Set(MENU_ITEMS.map((m) => m.id));

export function menuLabel(id: string): string {
  return LABEL_MAP.get(id) ?? id;
}

/** 라우트 pathname → menu_id. '/'·빈값은 'home'. 그 외는 첫 세그먼트. */
export function menuIdFromPath(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ? seg : "home";
}
