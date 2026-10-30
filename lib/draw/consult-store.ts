// spec 039 — 상담 기록 이미지용 그림 저장/불러오기(브라우저 전용).
// 상담 이미지 버킷(공개)에 ① 보기용 그림 ② 편집용 기록(.draw.json) ③ 아직 없던 원본을 나란히 올린다.
// 기록 본문 <img>에는 data-draw="<기록 URL>"을 달아 두고, 다시 열 때 이 기록과 원본으로 층을 복원한다.

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { compressImageFile } from "@/lib/image/optimize";
import { DRAW_DOC_SUFFIX, upgradeDoc, type DrawDoc } from "@/lib/draw/doc";
import type { DrawResult } from "@/components/draw/draw-editor";

const bucket = () => process.env.NEXT_PUBLIC_SUPABASE_CONSULTATION_BUCKET ?? "consultation-images";

/** 상담 이미지 올리기(압축 후) → 공개 URL */
export async function uploadConsultImage(file: File): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const optimized = await compressImageFile(file);
  const ext =
    optimized.type === "image/webp" ? "webp" : (optimized.name.split(".").pop()?.toLowerCase() ?? "png");
  const path = `inline/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket())
    .upload(path, optimized, { contentType: optimized.type || undefined });
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket()).getPublicUrl(path).data.publicUrl;
}

/** 그림 저장 → { src: 보기용 그림 URL, draw: 편집용 기록 URL } */
export async function saveConsultDrawing(r: DrawResult): Promise<{ src: string; draw: string }> {
  const supabase = createBrowserSupabaseClient();
  const doc: DrawDoc = { ...r.doc, base: { ...r.doc.base } };
  if (r.base && !doc.base.ref) {
    const name = `base.${r.base.type.split("/")[1] || "png"}`;
    doc.base.ref = await uploadConsultImage(new File([r.base], name, { type: r.base.type || "image/png" }));
  }
  const src = await uploadConsultImage(r.file);
  const path = `inline/${crypto.randomUUID()}${DRAW_DOC_SUFFIX}`;
  const { error } = await supabase.storage
    .from(bucket())
    .upload(path, new Blob([JSON.stringify(doc)], { type: "application/json" }), { contentType: "application/json" });
  if (error) throw new Error(error.message);
  return { src, draw: supabase.storage.from(bucket()).getPublicUrl(path).data.publicUrl };
}

/** 이미지 하나를 그리기 엔진으로 열 준비 — 편집용 기록이 있으면 원본+기록, 없으면 지금 그림을 바탕으로 */
export async function loadConsultDrawing(
  src: string,
  drawUrl?: string | null,
): Promise<{ image: Blob | null; doc: DrawDoc | null; ref: string }> {
  if (drawUrl) {
    try {
      const doc = upgradeDoc(await (await fetch(drawUrl)).json());
      if (doc) {
        const image = doc.base.ref ? await (await fetch(doc.base.ref)).blob() : null;
        return { image, doc, ref: doc.base.ref ?? src };
      }
    } catch {
      // 기록을 못 읽으면 보기용 그림 위에 덧그리기로
    }
  }
  return { image: await (await fetch(src)).blob(), doc: null, ref: src };
}
