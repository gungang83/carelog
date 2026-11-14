// spec 040 — "가리킨 곳" 공용 모양. 2D 차트(ChartHit)와 3D(광선 적중)가 같은 입력 규칙을 쓰게 한다.

import type { ChartHit } from "@/lib/dental/chart";
import type { Fdi } from "@/lib/dental/teeth";
import type { Pos, Side } from "@/lib/oral/perio";

export type PerioPick = {
  t: Fdi;
  s: Side;
  p: Pos;
  /** CEJ 기준 mm(+ 치관 쪽, − 뿌리 쪽) */
  mm: number;
  /** crown·root = 치아 위 · band = 숫자 띠(입력 없음) · beyond = 뿌리 끝 너머(= F) */
  zone: "crown" | "root" | "band" | "beyond";
};

export function pickFromHit(hit: ChartHit): PerioPick {
  const zone: PerioPick["zone"] =
    hit.zone === "label" ? (hit.row.spec.rootUp === hit.y < hit.row.toothTop ? "beyond" : "band") : hit.zone;
  return { t: hit.t, s: hit.row.spec.side, p: hit.p, mm: hit.mm, zone };
}
