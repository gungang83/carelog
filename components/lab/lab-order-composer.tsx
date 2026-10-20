"use client";

// spec 035 — 기공지 작성 화면. 위생사가 진료 중 그 자리에서 쓴다(종이 대체).
// 기공소 선택(EO 정본, 미발효 시 직접 입력) · 환자 검색 · 치식도 · 고정 필드 ·
// 동적 양식(데이터 정의) · 첨부(사진 압축·동영상·손그림) · 보내기(큐 — 유실 없음).

import { useMemo, useRef, useState, useTransition } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { compressImageFile } from "@/lib/image/optimize";
import { searchPatients } from "@/app/actions/patients";
import {
  createLabAttachmentUpload,
  submitLabOrder,
  type LabOrderContext,
} from "@/app/actions/lab-orders";
import {
  LAB_ATTACH_LIMITS,
  type LabAttachmentKind,
  type LabAttachmentMeta,
  type LabOrderFormRow,
} from "@/lib/lab-orders";
import type { PatientRow } from "@/lib/types/database";
import { ToothChart } from "@/components/lab/tooth-chart";
import { SketchPad } from "@/components/lab/sketch-pad";

const labBucket = "lab-orders";

function fieldInputCls() {
  return "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm";
}

export function LabOrderComposer({
  ctx,
  onDone,
  onCancel,
}: {
  ctx: LabOrderContext;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const orderIdRef = useRef<string>(crypto.randomUUID());
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  // 기공소
  const [labName, setLabName] = useState(ctx.labs?.[0]?.lab_name ?? "");
  // 환자
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientRow[]>([]);
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [manualPatientName, setManualPatientName] = useState("");
  // 담당
  const [doctor, setDoctor] = useState("");
  const [hygienist, setHygienist] = useState("");
  // 치식·보철·고정 필드
  const [tooth, setTooth] = useState<string[]>([]);
  const [prosthesis, setProsthesis] = useState("");
  const [material, setMaterial] = useState("");
  const [shadeSystem, setShadeSystem] = useState("");
  const [shade, setShade] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [orderType, setOrderType] = useState<"의뢰" | "수정" | "재제작">("의뢰");
  const [remakeReason, setRemakeReason] = useState("");
  const [instructions, setInstructions] = useState("");
  // 양식
  const [formId, setFormId] = useState(pickForm(ctx.forms, labName)?.id ?? ctx.forms[0]?.id ?? "");
  const form = useMemo(
    () => ctx.forms.find((f) => f.id === formId) ?? ctx.forms[0] ?? null,
    [ctx.forms, formId],
  );
  const [values, setValues] = useState<Record<string, unknown>>({});
  // 첨부
  const [attachments, setAttachments] = useState<LabAttachmentMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);

  function pickForm(forms: LabOrderFormRow[], lab: string): LabOrderFormRow | undefined {
    return forms.find((f) => f.lab_name === lab) ?? forms.find((f) => !f.lab_name);
  }

  const handleLabChange = (name: string) => {
    setLabName(name);
    const f = pickForm(ctx.forms, name);
    if (f) setFormId(f.id);
  };

  const doSearch = () => {
    startTransition(async () => {
      const r = await searchPatients(patientQuery);
      if (r.ok) setPatientResults(r.patients.slice(0, 8));
      else setMsg(r.message);
    });
  };

  const setValue = (id: string, v: unknown) => setValues((prev) => ({ ...prev, [id]: v }));

  // ── 첨부 업로드(서명 업로드 URL — 액션 바디 한도 우회) ──
  const uploadBlob = async (blob: Blob, name: string, kind: LabAttachmentKind) => {
    const total = attachments.reduce((s, a) => s + a.bytes, 0) + blob.size;
    if (total > LAB_ATTACH_LIMITS.total) {
      setMsg("첨부 합계가 100MB를 초과합니다 — 일부를 빼 주세요.");
      return;
    }
    setUploading(true);
    setMsg("");
    try {
      const prep = await createLabAttachmentUpload(orderIdRef.current, name, kind, blob.size);
      if (!prep.ok) {
        setMsg(prep.message);
        return;
      }
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.storage
        .from(labBucket)
        .uploadToSignedUrl(prep.path, prep.token, blob, {
          contentType: blob.type || "application/octet-stream",
        });
      if (error) {
        setMsg(`업로드 실패: ${error.message}`);
        return;
      }
      setAttachments((prev) => [...prev, { kind, name, bytes: blob.size, path: prep.path }]);
    } finally {
      setUploading(false);
    }
  };

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    const compressed = await compressImageFile(file); // spec 017 webp 압축 재사용
    if (compressed.size > LAB_ATTACH_LIMITS.photo) {
      setMsg("사진은 5MB 이하로 올려주세요.");
      return;
    }
    await uploadBlob(compressed, compressed.name, "photo");
  };

  const handleVideo = async (file: File | null) => {
    if (!file) return;
    if (file.size > LAB_ATTACH_LIMITS.video) {
      setMsg("동영상은 50MB 이하(약 30초)로 올려주세요.");
      return;
    }
    // 30초 제한(합의) — 메타데이터로 길이 확인(실패 시 용량 제한만 적용)
    const seconds = await new Promise<number | null>((res) => {
      try {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(v.src);
          res(Number.isFinite(v.duration) ? v.duration : null);
        };
        v.onerror = () => res(null);
        v.src = URL.createObjectURL(file);
      } catch {
        res(null);
      }
    });
    if (seconds !== null && seconds > LAB_ATTACH_LIMITS.videoSeconds + 1) {
      setMsg(`동영상은 ${LAB_ATTACH_LIMITS.videoSeconds}초 이내로 올려주세요 (현재 ${Math.round(seconds)}초).`);
      return;
    }
    await uploadBlob(file, file.name, "video");
  };

  const handleSketchDone = async (blob: Blob) => {
    setSketchOpen(false);
    await uploadBlob(blob, `sketch_${Date.now()}.png`, "sketch");
  };

  const patientName = patient?.name ?? manualPatientName.trim();

  const submit = () => {
    setMsg("");
    startTransition(async () => {
      const r = await submitLabOrder({
        orderId: orderIdRef.current,
        labName,
        patientId: patient ? Number(patient.id) : null,
        patientName,
        chartNo: patient?.chart_no ?? undefined,
        doctor: doctor || undefined,
        hygienist: hygienist || undefined,
        tooth,
        prosthesis,
        material: material || undefined,
        shadeSystem: shadeSystem || undefined,
        shade: shade || undefined,
        dueDate,
        orderType,
        remakeReason: remakeReason || undefined,
        formId: form?.id ?? "",
        values,
        instructions: instructions || undefined,
        attachments,
      });
      if (r.ok) onDone(r.message);
      else setMsg(r.message);
    });
  };

  return (
    <section className="space-y-5 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">새 기공지</h2>
        <button onClick={onCancel} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50">
          닫기
        </button>
      </div>

      {msg && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{msg}</div>}

      {/* 기공소 */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">기공소</label>
        {ctx.labs && ctx.labs.length > 0 ? (
          <select value={labName} onChange={(e) => handleLabChange(e.target.value)} className={fieldInputCls()}>
            {ctx.labs.map((l) => (
              <option key={l.lab_name} value={l.lab_name}>
                {l.lab_name}
                {l.portal_enabled ? "" : " (포탈 미사용)"}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              value={labName}
              onChange={(e) => handleLabChange(e.target.value)}
              placeholder="기공소 이름 (예: 지플란트기공소)"
              className={fieldInputCls()}
            />
            <p className="text-xs text-slate-400">
              EO 기공소 목록 연동 전이라 이름을 직접 입력합니다 — EO 거래처명과 같게 적어주세요.
            </p>
          </>
        )}
      </div>

      {/* 환자 */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">환자</label>
        {patient ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
            <span className="font-medium text-emerald-800">{patient.name}</span>
            {patient.chart_no && <span className="text-xs text-emerald-600">차트 {patient.chart_no}</span>}
            <button onClick={() => setPatient(null)} className="ml-auto text-xs text-emerald-600 hover:underline">
              변경
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())}
                placeholder="이름·차트번호·전화로 검색"
                className={fieldInputCls()}
              />
              <button onClick={doSearch} disabled={isPending} className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-40">
                검색
              </button>
            </div>
            {patientResults.length > 0 && (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {patientResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPatient(p);
                      setPatientResults([]);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">{p.name}</span>
                    {p.chart_no && <span className="text-xs text-slate-400">차트 {p.chart_no}</span>}
                    {p.phone && <span className="text-xs text-slate-400">{p.phone}</span>}
                  </button>
                ))}
              </div>
            )}
            <input
              value={manualPatientName}
              onChange={(e) => setManualPatientName(e.target.value)}
              placeholder="또는 환자명 직접 입력(미등록 환자)"
              className={fieldInputCls()}
            />
          </>
        )}
      </div>

      {/* 담당 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Dr. (원장)</label>
          <input value={doctor} onChange={(e) => setDoctor(e.target.value)} className={fieldInputCls()} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">D.H. (작성자)</label>
          <input value={hygienist} onChange={(e) => setHygienist(e.target.value)} className={fieldInputCls()} />
        </div>
      </div>

      {/* 치식도 */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">치식</label>
        <ToothChart selected={tooth} onChange={setTooth} />
      </div>

      {/* 보철·재료·Shade·납기·구분 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">보철 종류 *</label>
          <select value={prosthesis} onChange={(e) => setProsthesis(e.target.value)} className={fieldInputCls()}>
            <option value="">선택…</option>
            {(form?.def.prosthesis_options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">재료</label>
          <input value={material} onChange={(e) => setMaterial(e.target.value)} className={fieldInputCls()} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Shade</label>
          <div className="flex gap-2">
            <select value={shadeSystem} onChange={(e) => setShadeSystem(e.target.value)} className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
              <option value="">체계…</option>
              {(form?.def.shade_systems ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input value={shade} onChange={(e) => setShade(e.target.value)} placeholder="예: A2 / 치경부 A3" className={fieldInputCls()} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">완료(납기)일 *</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldInputCls()} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-slate-700">구분</label>
        {(["의뢰", "수정", "재제작"] as const).map((t) => (
          <label key={t} className="flex items-center gap-1 text-sm text-slate-600">
            <input type="radio" checked={orderType === t} onChange={() => setOrderType(t)} />
            {t}
          </label>
        ))}
        {orderType === "재제작" && (
          <input
            value={remakeReason}
            onChange={(e) => setRemakeReason(e.target.value)}
            placeholder="재제작 사유 *"
            className="min-w-64 flex-1 rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm"
          />
        )}
      </div>

      {/* 동적 양식 — 데이터 정의 렌더 */}
      {form && (
        <div className="space-y-3">
          {ctx.forms.length > 1 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              양식:
              <select value={formId} onChange={(e) => setFormId(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                {ctx.forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.lab_name ? `[${f.lab_name}] ` : "[공통] "}
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.def.sections.map((section) => (
            <details key={section.id} open className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">{section.title}</summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      {field.label}
                      {field.unit ? ` (${field.unit})` : ""}
                    </label>
                    {field.type === "select" && (
                      <select
                        value={(values[field.id] as string) ?? ""}
                        onChange={(e) => setValue(field.id, e.target.value)}
                        className={fieldInputCls()}
                      >
                        <option value="">—</option>
                        {(field.options ?? []).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    )}
                    {field.type === "multi" && (
                      <div className="flex flex-wrap gap-1.5">
                        {(field.options ?? []).map((o) => {
                          const cur = (values[field.id] as string[]) ?? [];
                          const on = cur.includes(o);
                          return (
                            <button
                              key={o}
                              type="button"
                              onClick={() => setValue(field.id, on ? cur.filter((x) => x !== o) : [...cur, o])}
                              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                                on ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {field.type === "check" && (
                      <label className="flex items-center gap-1.5 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={values[field.id] === true}
                          onChange={(e) => setValue(field.id, e.target.checked)}
                        />
                        해당
                      </label>
                    )}
                    {field.type === "ea" && (
                      <input
                        type="number"
                        min={0}
                        value={(values[field.id] as number) ?? ""}
                        onChange={(e) => setValue(field.id, e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="EA"
                        className={fieldInputCls()}
                      />
                    )}
                    {field.type === "number" && (
                      <input
                        type="number"
                        value={(values[field.id] as number) ?? ""}
                        onChange={(e) => setValue(field.id, e.target.value === "" ? "" : Number(e.target.value))}
                        className={fieldInputCls()}
                      />
                    )}
                    {field.type === "date" && (
                      <input
                        type="date"
                        value={(values[field.id] as string) ?? ""}
                        onChange={(e) => setValue(field.id, e.target.value)}
                        className={fieldInputCls()}
                      />
                    )}
                    {(field.type === "text" || field.type === "textarea") &&
                      (field.type === "textarea" ? (
                        <textarea
                          value={(values[field.id] as string) ?? ""}
                          onChange={(e) => setValue(field.id, e.target.value)}
                          rows={2}
                          placeholder={field.hint}
                          className={fieldInputCls()}
                        />
                      ) : (
                        <input
                          value={(values[field.id] as string) ?? ""}
                          onChange={(e) => setValue(field.id, e.target.value)}
                          placeholder={field.hint}
                          className={fieldInputCls()}
                        />
                      ))}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* 기타 주문사항 */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">기타 주문사항 (환자분 요구사항 포함)</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder={'예: "디자인 시 휘어나오면 치과에 상의해 주세요"'}
          className={fieldInputCls()}
        />
      </div>

      {/* 첨부 */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">첨부 (사진·동영상·손그림)</label>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            📷 사진
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void handlePhoto(e.target.files?.[0] ?? null)} />
          </label>
          <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            🎬 동영상 (30초)
            <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => void handleVideo(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" onClick={() => setSketchOpen(true)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            ✏️ 그림 지시
          </button>
          {uploading && <span className="text-xs text-slate-400">업로드 중…</span>}
        </div>
        {attachments.length > 0 && (
          <ul className="space-y-1">
            {attachments.map((a, i) => (
              <li key={a.path} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
                <span>{a.kind === "photo" ? "📷" : a.kind === "video" ? "🎬" : "✏️"}</span>
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="text-slate-400">{(a.bytes / 1024 / 1024).toFixed(1)}MB</span>
                <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-rose-500 hover:underline">
                  빼기
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 제출 */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          취소
        </button>
        <button
          onClick={submit}
          disabled={isPending || uploading || !labName.trim() || !patientName || !prosthesis || !dueDate}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {isPending ? "보내는 중…" : "기공소로 보내기"}
        </button>
      </div>

      {sketchOpen && <SketchPad onDone={(b) => void handleSketchDone(b)} onCancel={() => setSketchOpen(false)} />}
    </section>
  );
}
