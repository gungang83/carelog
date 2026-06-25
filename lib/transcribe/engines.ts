// 녹음 엔진 레지스트리 — 공유 타입·상수(서버 액션 아님).
// "use server" 파일(app/actions/transcribe.ts)은 async 함수만 export 가능하므로,
// 런타임 상수(LAB_ENGINE_OPTIONS)와 타입은 이 일반 모듈에 둔다.

// basic        = 기존 기본모델(한국어 Whisper + Claude 요약). 모든 워크스페이스 기본.
// multilingual = 자동 언어감지 + 번역(원문/번역/요약). 실험실(예미안) 전용.
// 'comparison' = 엔진이 아니라 실행 모드(basic+multilingual 동시).
export type EngineId = "basic" | "multilingual";
export type EngineMode = EngineId | "comparison";

export const LAB_ENGINE_OPTIONS: { value: EngineMode; label: string; desc: string }[] = [
  { value: "basic", label: "기본모델", desc: "한국어 전사 + 요약 (현재 기본)" },
  { value: "multilingual", label: "다국어", desc: "자동 언어감지 + 번역(원문/번역/요약)" },
  { value: "comparison", label: "비교", desc: "기본 + 다국어 동시 실행해 나란히 비교" },
];

/** 단일 엔진 실행 결과 — UI는 insertText를 그대로 에디터에 넣으면 된다. */
export type EngineRun = {
  engine: EngineId;
  label: string;
  transcription: string; // 원문 전사
  summary: string; // 한국어 상담기록 요약
  translation?: string; // 번역(원문이 한국어가 아니면 한국어로, 한국어면 영어로)
  detectedLang?: string; // 감지된 원문 언어 코드
  insertText: string; // 에디터 삽입용 정형 텍스트
};

export type EngineTranscribeResult =
  | { ok: true; runs: EngineRun[] }
  | { ok: false; message: string };
