/** localStorage 키: 기기별 상담 위치(스테이션). */
export const CARELOG_STATION_STORAGE_KEY = "carelog_station";

/** 이전 버전 키(한 번 읽어 마이그레이션). */
export const CARELOG_STATION_STORAGE_KEY_LEGACY = "carelog_station_name";

export type StationOption = { readonly value: string; readonly label: string };

export const STATION_OPTIONS: readonly StationOption[] = [
  { value: "", label: "미설정" },
  { value: "체어 01", label: "체어 01" },
  { value: "체어 02", label: "체어 02" },
  { value: "체어 03", label: "체어 03" },
  { value: "체어 04", label: "체어 04" },
  { value: "체어 05", label: "체어 05" },
  { value: "상담실 A", label: "상담실 A" },
  { value: "상담실 B", label: "상담실 B" },
  { value: "원장실", label: "원장실" },
  { value: "데스크", label: "데스크" },
] as const;

const KNOWN_VALUES = new Set(
  STATION_OPTIONS.map((o) => o.value).filter((v) => v.length > 0),
);

export function labelForStationValue(value: string): string {
  const trimmed = value.trim();
  const hit = STATION_OPTIONS.find((o) => o.value === trimmed);
  if (hit) return hit.label;
  return trimmed || "미설정";
}

export function isKnownStationValue(value: string): boolean {
  const t = value.trim();
  return t === "" || KNOWN_VALUES.has(t);
}
