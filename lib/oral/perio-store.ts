// spec 040 — 상담 기록에 담은 잇몸 기록을 "다시 열어 고치기" 위한 기록(브라우저 전용).
// 차트 그림 <img data-perio="<URL>"> 옆에 측정 기록을 JSON으로 둔다(그리기 엔진 .draw.json과 같은 방식).
// ★환자 이름은 넣지 않는다(공개 버킷 — 주소를 아는 사람만 열 수 있지만 식별정보는 피한다). 환자 id·회차 id만.

import { uploadConsultJson } from "@/lib/draw/consult-store";
import { normalizePerio, type PerioData } from "@/lib/oral/perio";

export type PerioSnapshot = { v: 1; date: string; data: PerioData; examId?: string | null; patientId?: string | null };

export const PERIO_SUFFIX = ".perio.json";

export function savePerioSnapshot(s: PerioSnapshot): Promise<string> {
  return uploadConsultJson(s, PERIO_SUFFIX);
}

export async function loadPerioSnapshot(url: string): Promise<PerioSnapshot | null> {
  try {
    const raw = (await (await fetch(url)).json()) as Partial<PerioSnapshot>;
    if (raw?.v !== 1 || typeof raw.date !== "string") return null;
    return { v: 1, date: raw.date, data: normalizePerio(raw.data), examId: raw.examId ?? null, patientId: raw.patientId ?? null };
  } catch {
    return null;
  }
}
