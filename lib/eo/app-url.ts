// EO 주소 한 곳에서 — Vercel 환경변수 EO_APP_URL, 없으면 eo.ai.kr(옛 eo-ten.vercel.app은 308로 넘어감).
const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

export const EO_APP_URL = stripBom(process.env.EO_APP_URL ?? "").trim().replace(/\/+$/, "") || "https://eo.ai.kr";
