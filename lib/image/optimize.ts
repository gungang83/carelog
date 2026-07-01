// spec 017 이그레스 절감 — 이미지 업로드 압축 + 표시용 변환(Supabase image render).
//   업로드: 원본(수 MB) → 다운스케일 + webp 인코딩(~10배↓). 저장·전송 동시 절감.
//   표시: 공개 URL을 render/image 변환 URL로 바꿔 작은 변형본을 받음(기존 이미지에도 효과) + lazy.

/** 업로드 전 이미지 압축(브라우저 전용). 실패·이득 없음이면 원본 그대로. */
export async function compressImageFile(
  file: File,
  { maxDim = 1600, quality = 0.82 }: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  // gif(애니메이션)·비이미지는 건드리지 않음
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    // EXIF 방향 반영(치과 카메라 사진 회전 방지)
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
    if (!blob || blob.size >= file.size) return file; // 이미 작으면 원본 유지
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

/** 공개 Storage URL → 이미지 변환(render) URL. 변환 대상이 아니면 원본 반환.
 *  ★안전장치: NEXT_PUBLIC_IMG_TRANSFORM=off 면 변환을 끄고 원본 반환(이미지 변환 사용량 회피).
 *  변환을 꺼도 업로드 압축·lazy 효과는 그대로 유지된다. */
export function optimizeStorageUrl(
  url: string,
  { width, quality = 70 }: { width?: number; quality?: number } = {},
): string {
  if (process.env.NEXT_PUBLIC_IMG_TRANSFORM === "off") return url;
  if (!url || !url.includes("/storage/v1/object/public/")) return url;
  const base = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  const params = [width ? `width=${width}` : "", `quality=${quality}`, "resize=contain"]
    .filter(Boolean)
    .join("&");
  return `${base}${base.includes("?") ? "&" : "?"}${params}`;
}

/** 본문 HTML의 <img> — src를 변환 URL로 바꾸고 loading="lazy" 부여(오프스크린 로드 방지). */
export function optimizeContentHtml(
  html: string,
  { width = 1000, quality = 72 }: { width?: number; quality?: number } = {},
): string {
  if (!html) return html;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag.replace(/src="([^"]+)"/i, (_, u) => `src="${optimizeStorageUrl(u, { width, quality })}"`);
    if (!/\bloading=/i.test(t)) t = t.replace(/<img\b/i, '<img loading="lazy"');
    return t;
  });
}
