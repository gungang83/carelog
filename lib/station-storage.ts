/** localStorage key for 현재 상담 위치(스테이션). */
export const CARELOG_STATION_STORAGE_KEY = "carelog_station_name";

/** 헤더·상담 폼에서 동일한 옵션을 쓰기 위한 프리셋. */
export const STATION_PRESETS = [
  "체어 01",
  "체어 02",
  "체어 03",
  "체어 04",
  "체어 05",
  "상담실",
  "원장실",
] as const;

export type StationPreset = (typeof STATION_PRESETS)[number];
