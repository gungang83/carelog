"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { saveConsultation } from "@/app/actions/consultations";
import { CARELOG_STATION_STORAGE_KEY } from "@/lib/station-storage";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";
import { VoiceRecorder } from "@/components/consultation/voice-recorder";

type Props = { patientId: string; patientName: string };

export function ConsultationForm({ patientId, patientName }: Props) {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

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

          let stationName = "";
          try {
            stationName = (
              window.localStorage.getItem(CARELOG_STATION_STORAGE_KEY) ?? ""
            ).trim();
          } catch {
            stationName = "";
          }
          fd.set("stationName", stationName);

          try {
            const res = await saveConsultation(patientId, content, fd);
            if (!res.ok) {
              setOk(false);
              setMessage(res.message);
              return;
            }
          } catch (err) {
            if (isRedirectError(err)) {
              setContent("");
              setSelectedProducts([]);
              return;
            }
            throw err;
          }
        });
      }}
    >
      {/* 상담 내용 */}
      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-800">
              상담 내용
            </label>
            <p className="mt-1 text-xs text-slate-500">
              {patientName} 님의 주소증 / 처치 / 다음 내원 안내를 기록하세요.
            </p>
          </div>
          <VoiceRecorder
            onResult={(text) => editorRef.current?.insertText(text)}
          />
        </div>
        <RichTextEditor
          ref={editorRef}
          value={content}
          onChange={setContent}
          placeholder="예: 주소증, 처치 내용, 진단 소견, 다음 내원 안내 등..."
        />
      </div>

      {/* 추천 제품 처방 */}
      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-800">
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
          name="prescriptions"
          type="hidden"
          value={JSON.stringify(selectedProducts)}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          {products.map((p) => {
            const isSelected = selectedProducts.includes(p.name);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setSelectedProducts((prev) =>
                    prev.includes(p.name)
                      ? prev.filter((x) => x !== p.name)
                      : [...prev, p.name],
                  );
                }}
                className={[
                  "flex flex-col items-start gap-2 rounded-2xl border px-5 py-5 text-left shadow-sm transition min-h-[96px]",
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
            <div className="text-xs font-semibold text-slate-600">선택된 제품</div>
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

      {/* 동의 */}
      <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
        <label className="flex items-start gap-3">
          <input
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

      {/* 저장 버튼 */}
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
