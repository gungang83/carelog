"use client";

import { useState } from "react";

// 카드 #745 — About '창업자 편지'. 환자·보호자 대상, 1인칭 편지체, 좌측정렬·차분한 배경·하단 서명.
//   모바일: 첫 문단만 노출 + '더 읽기'로 펼침. 데스크톱(sm↑)은 전문 노출.
export function FounderLetter() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="bg-gradient-to-b from-sky-50 to-white py-20 sm:py-24">
      <div className="mx-auto max-w-2xl px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
          창업자 편지
        </p>

        {/* 히어로 — 리드 문장 */}
        <h2 className="mt-4 text-2xl font-bold leading-snug tracking-tight text-slate-800 break-keep sm:text-3xl">
          좋은 돌봄은, 좋은 사람들에게서 나옵니다.
          <br />
          그리고 그 따뜻함이 당신에게 닿기를 바랍니다.
        </h2>

        {/* 본문 — 좌측정렬 읽기 */}
        <div className="mt-8 space-y-5 text-[15px] leading-8 text-slate-600 sm:text-base">
          <p className="break-keep">
            저는 치과의사입니다. 매일 진료실에서 한 분 한 분을 마주하며, 한 사람의
            건강이 그 사람의 삶 전체를 얼마나 바꾸는지를 봅니다. 의료는 사람의 삶을
            가장 가까이에서 바꾸는 일이니까요.
          </p>

          {/* 접히는 영역 — 모바일 미확장 시 숨김, 데스크톱은 항상 노출 */}
          <div className={`${expanded ? "block" : "hidden sm:block"} space-y-5`}>
            <p className="break-keep">
              그래서 저는 이런 선순환을 꿈꿉니다. 의료진이 행복하게 일하고, 그
              따뜻함이 환자에게 전해지고, 건강을 되찾은 당신이 다시 당신의 삶으로
              돌아가 또 누군가를 행복하게 하는 것.
            </p>
            <p className="break-keep">
              Carelog는 그 선순환이 당신에게 닿는 자리입니다. 흩어져 있던 당신의
              건강 기록이 병원과 자연스럽게 이어져, 더 정확하고 더 따뜻한 돌봄으로
              돌아오도록. 당신이 당신의 건강을, 조금 더 편하게 챙길 수 있도록.
            </p>
            <p className="break-keep">
              제가 가진 경험과 기술로 우리 의료 환경을 조금이라도 더 낫게 만들 수
              있다면, 그것만으로 충분히 의미 있는 일이라고 믿습니다.
            </p>

            {/* 하단 서명 */}
            <div className="mt-8 border-t border-sky-100 pt-6">
              <p className="text-sm font-medium text-slate-700 break-keep">
                — 송정현, Carelog 창업자 · 치과의사
              </p>
            </div>
          </div>
        </div>

        {/* 더 읽기 / 접기 — 모바일 전용 */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 transition hover:text-sky-800 sm:hidden"
        >
          {expanded ? "접기 ▲" : "더 읽기 ▼"}
        </button>
      </div>
    </section>
  );
}
