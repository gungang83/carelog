"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveConsultation } from "@/app/actions/consultations";
import { useRouter } from "next/navigation";

type Props = { patientId: string; patientName: string };

type Preview = {
  id: string;
  url: string;
  file: File;
};

export function ConsultationForm({ patientId, patientName }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const urlsRef = useRef<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // 치과에서 바로 추천하는 기본 제품
  const products = useMemo(
    () => [
      { name: "미세모 칫솔", hint: "부드럽게 관리" },
      { name: "고불소 치약", hint: "충치 예방" },
      { name: "치간 칫솔", hint: "치아 사이 케어" },
      { name: "무알콜 가글", hint: "자극은 줄이고 상쾌하게" },
    ],
    [],
  );

  const getProductIconLabel = (name: string) => {
    const map: Record<string, string> = {
      "미세모 칫솔": "칫솔",
      "고불소 치약": "치약",
      "치간 칫솔": "치간",
      "무알콜 가글": "가글",
    };
    const label = map[name] ?? name;
    return label.length > 3 ? label.slice(0, 3) : label;
  };

  // 미리보기용 Object URL 정리
  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const selectedFiles = useMemo(() => previews.map((p) => p.file), [previews]);

  // FormData에 포함되도록 input.files를 previews에 맞춰 동기화합니다.
  useEffect(() => {
    if (!inputRef.current) return;
    const dt = new DataTransfer();
    for (const f of selectedFiles) dt.items.add(f);
    inputRef.current.files = dt.files;
  }, [selectedFiles]);

  function addFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    const nextPreviews: Preview[] = images.map((file) => {
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      return { id: crypto.randomUUID(), url, file };
    });

    setPreviews((prev) => [...prev, ...nextPreviews]);
  }

  function removePreview(id: string) {
    setPreviews((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  }

  function clearFiles() {
    setPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFilesFromFileList(fileList: FileList | null) {
    if (!fileList) return;
    addFiles(Array.from(fileList));
  }

  return (
    <form
      className="flex flex-col gap-6"
      action={(fd) => {
        setMessage(null);
        setOk(false);
        startTransition(async () => {
          const mode = String(fd.get("submit_mode") ?? "save");
          const consent = fd.get("consent") === "on";

          if (mode === "send" && !consent) {
            setOk(false);
            setMessage("개인정보 활용 및 전송 동의가 필요합니다.");
            return;
          }

          const res = await saveConsultation(patientId, content, fd);
          if (!res.ok) {
            setOk(false);
            setMessage(res.message);
            return;
          }
          setOk(true);
          const isSend = mode === "send";
          setMessage(
            isSend
              ? "전송용 링크가 생성되었습니다."
              : "상담 내용이 저장되었습니다.",
          );
          setContent("");
          clearFiles();
          setSelectedProducts([]);
          window.alert(
            isSend
              ? "전송용 링크가 생성되었습니다."
              : "상담 내용이 저장되었습니다.",
          );
          router.push("/");
        });
      }}
    >
      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <label
          htmlFor="content"
          className="text-sm font-semibold text-slate-800"
        >
          상담 내용
        </label>
        <p className="mt-1 text-xs text-slate-500">
          {patientName} 님의 주소증/처치/다음 내원 안내를 크게 기록하세요.
        </p>
        <textarea
          id="content"
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          placeholder="예: 주소증, 처치 내용, 진단 소견, 다음 내원 안내 등..."
          className="mt-3 min-h-[240px] w-full resize-y rounded-xl border border-sky-200 bg-white px-4 py-3 text-slate-900 outline-none ring-sky-400/30 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2"
        />
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <label
          htmlFor="images"
          className="text-sm font-semibold text-slate-800"
        >
          이미지 업로드
        </label>
        <p className="mt-1 text-xs text-slate-500">
          이미지 파일을 여러 장 선택하거나 드래그해서 업로드하세요.
        </p>

        <input
          ref={inputRef}
          id="images"
          name="images"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFilesFromFileList(e.target.files)}
          className="sr-only"
        />

        <div
          className={[
            "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition",
            isDragging
              ? "border-sky-500 bg-sky-50"
              : "border-sky-200 bg-sky-50/30 hover:bg-sky-50",
          ].join(" ")}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            addFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <div className="text-sm font-semibold text-sky-800">
            {isDragging ? "여기에 놓으면 업로드됩니다" : "여기를 클릭하거나 끌어서 업로드"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            최대 여러 장 업로드 가능 (업로드는 저장 시 진행)
          </div>
        </div>

        {previews.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold text-slate-600">
              미리보기 ({previews.length})
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previews.map((p) => (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-xl border border-sky-100 bg-white"
                >
                  {/* objectURL은 외부 리소스가 아닌 로컬 파일 미리보기용입니다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt="preview"
                    className="h-28 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePreview(p.id)}
                    className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-slate-700 opacity-0 shadow-sm transition hover:bg-white group-hover:opacity-100"
                  >
                    제거
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={clearFiles}
                className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-xs font-semibold text-sky-800 shadow-sm hover:bg-sky-50"
              >
                선택한 이미지 모두 삭제
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <label
              className="text-sm font-semibold text-slate-800"
              htmlFor="prescriptions"
            >
              추천 제품 처방
            </label>
            <p className="mt-1 text-xs text-slate-500">
              치과에서 기본으로 추천하는 제품을 선택해 주세요.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            선택 {selectedProducts.length}개
          </div>
        </div>

        <input
          id="prescriptions"
          name="prescriptions"
          type="hidden"
          value={JSON.stringify(selectedProducts)}
        />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
          {products.map((p) => {
            const isSelected = selectedProducts.includes(p.name);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setSelectedProducts((prev) => {
                    if (prev.includes(p.name)) {
                      return prev.filter((x) => x !== p.name);
                    }
                    return [...prev, p.name];
                  });
                }}
                className={[
                  "flex flex-col items-start gap-2 rounded-2xl border px-5 py-5 text-left shadow-sm transition",
                  "min-h-[96px]",
                  isSelected
                    ? "border-sky-500 bg-sky-50"
                    : "border-sky-100 bg-white hover:bg-sky-50/40",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-bold",
                    isSelected ? "bg-sky-100 text-sky-700" : "bg-sky-50 text-sky-700",
                  ].join(" ")}
                >
                  {getProductIconLabel(p.name)}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {p.name}
                </span>
                <span className="text-xs text-slate-500">{p.hint}</span>
              </button>
            );
          })}
        </div>

        {selectedProducts.length ? (
          <div className="mt-4">
            <div className="text-xs font-semibold text-slate-600">
              선택된 제품
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedProducts.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() =>
                    setSelectedProducts((prev) => prev.filter((x) => x !== name))
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-sky-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                    {getProductIconLabel(name)}
                  </span>
                  {name}
                  <span className="ml-1 text-sky-700">×</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
        <label className="flex items-start gap-3">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            value="on"
            defaultChecked={false}
            className="mt-1 h-4 w-4 accent-sky-600"
          />
          <span className="text-sm text-slate-700">
            개인정보 활용 및 카카오 알림톡 전송 동의
          </span>
        </label>
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            name="submit_mode"
            value="save"
            disabled={pending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-sm shadow-sky-200 hover:bg-sky-700 disabled:opacity-60 sm:w-auto"
          >
            {pending ? "저장 중..." : "상담 저장"}
          </button>

          <button
            type="submit"
            name="submit_mode"
            value="send"
            disabled={pending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-sky-200 bg-white px-6 text-sm font-semibold text-sky-800 shadow-sm hover:bg-sky-50 disabled:opacity-60 sm:w-auto"
          >
            저장 후 환자 전송
          </button>
        </div>

        {message ? (
          <p
            className={`text-sm ${ok ? "text-emerald-600" : "text-red-600"}`}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
