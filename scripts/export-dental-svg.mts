// 치아 도식 라이브러리 → 편집용 SVG 파일 내보내기.
//   원본: lib/dental/teeth.ts (모양을 고칠 땐 원본을 고치고 이 스크립트를 다시 돌린다)
//   실행: node --experimental-strip-types scripts/export-dental-svg.mts
//   결과: public/dental-svg/
//     arch/occlusal-7-7.svg · occlusal-8-8.svg · facial-7-7.svg · facial-8-8.svg (치식 라벨 포함/미포함)
//     occlusal/<FDI>.svg · facial/<FDI>.svg (치아 32개 × 2방향)
//   각 치아는 <g id="tooth-FDI" data-fdi="FDI">로 묶여 있어 일러스트레이터·피그마에서 치아별로 골라 색을 바꿀 수 있다.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error -- Node(--experimental-strip-types)는 .ts 확장자를 붙여야 읽는다. Next 빌드 타입검사만 막는다.
import { ALL_TEETH, facialLayout, layoutSvg, occlusalLayout, singleToothSvg } from "../lib/dental/teeth.ts";

const out = join(process.cwd(), "public", "dental-svg");
for (const d of ["arch", "occlusal", "facial"]) mkdirSync(join(out, d), { recursive: true });

const write = (p: string, s: string) => writeFileSync(join(out, p), s, "utf8");

for (const third of [false, true]) {
  const tag = third ? "8-8" : "7-7";
  const occ = occlusalLayout({ withThirdMolars: third });
  const fac = facialLayout({ withThirdMolars: third });
  write(`arch/occlusal-${tag}.svg`, layoutSvg(occ, { labels: true, title: `교합면 전악 ${tag} (치식 표기)` }));
  write(`arch/occlusal-${tag}-plain.svg`, layoutSvg(occ, { labels: false, title: `교합면 전악 ${tag}` }));
  write(`arch/facial-${tag}.svg`, layoutSvg(fac, { labels: true, title: `정면 전악 ${tag} (치식 표기)` }));
  write(`arch/facial-${tag}-plain.svg`, layoutSvg(fac, { labels: false, title: `정면 전악 ${tag}` }));
}
for (const fdi of ALL_TEETH) {
  write(`occlusal/${fdi}.svg`, singleToothSvg(fdi, "occlusal"));
  write(`facial/${fdi}.svg`, singleToothSvg(fdi, "facial"));
}
console.log(`exported → ${out}`);
