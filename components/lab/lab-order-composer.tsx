"use client";

// spec 035 v2 — 기공지 작성·수정 화면. 위생사가 진료 중 그 자리에서 쓴다(종이 대체).
// 기공물 여러 개 = 한 세트([+ 기공물 추가]) · 의뢰일(기본 오늘)·완료 희망(납기)일 ·
// 거래했던 기공소 자동 제안 · 보낸 뒤 수정/첨부 추가(수정 이력 기록 — 전송 후 수정 명확 표시).

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { compressImageFile } from "@/lib/image/optimize";
import {
  createLabAttachmentUpload,
  getLabAttachmentPreviewUrls,
  submitLabOrderSet,
  type LabOrderContext,
  type LabOrderItemInput,
  type LabOrderSetSnapshot,
} from "@/app/actions/lab-orders";
import {
  LAB_ATTACH_LIMITS,
  type LabAttachmentKind,
  type LabAttachmentMeta,
  type LabOrderFormRow,
} from "@/lib/lab-orders";
import { PatientPicker, type PickedPatient } from "@/components/patients/patient-picker";
import { ToothChart } from "@/components/lab/tooth-chart";
import { ToothViewer } from "@/components/dental/tooth-viewer";
import { AttachmentGallery } from "@/components/lab/attachment-gallery";
import { DrawEditor, type DrawResult } from "@/components/draw/draw-editor";
import { DRAW_DOC_SUFFIX, upgradeDoc, type DrawDoc } from "@/lib/draw/doc";

const labBucket = "lab-orders";

function fieldInputCls() {
  return "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm";
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() {
  return toDateStr(new Date());
}
function addDays(base: string, days: number) {
  const d = base ? new Date(`${base}T00:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}
/** "Crown (Zirconia)" → "Zirconia" — 보철 종류에 재료가 포함된 경우 재료 자동 채움용 */
function materialFromProsthesis(label: string): string {
  const m = label.match(/\(([^)]+)\)$/);
  return m ? m[1].trim() : "";
}

type ItemState = LabOrderItemInput;

function newItem(): ItemState {
  return { orderId: crypto.randomUUID(), tooth: [], prosthesis: "", material: "", shadeSystem: "", shade: "", values: {} };
}

export function LabOrderComposer({
  ctx,
  initial,
  remake = false,
  onDone,
  onCancel,
}: {
  ctx: LabOrderContext;
  /** 수정 모드 — 기존 세트 스냅샷. 없으면 신규 작성. */
  initial?: LabOrderSetSnapshot | null;
  /** 재제작(계약 ⓘ-②) — 완료·청구 건 내용을 승계한 '새 의뢰'. initial이 있어도 신규처럼 동작. */
  remake?: boolean;
  onDone: (message: string, status: "sent" | "queued" | "failed") => void;
  onCancel: () => void;
}) {
  const editing = Boolean(initial) && !remake;
  const setIdRef = useRef<string>(initial?.setId ?? crypto.randomUUID());
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  // 기공소 — 카드 #1968: EO 목록이 살아 있으면 ★portal_enabled=true만 선택지로(「지플란트」/
  // 「지플란트기공소」 두 표기 함정 차단 — 거래원장 유래 이름은 공유 설정이 없어 거절된다),
  // 자유 입력도 막는다. lab_name은 목록 문자열 ★원문 그대로(매칭 키 — 변형 금지).
  // 게이트웨이 미발효(null)일 때만 거래 이력 제안 + 직접 입력 폴백.
  const eoLabs = useMemo(
    () => (ctx.labs ? ctx.labs.filter((l) => l.portal_enabled) : null),
    [ctx.labs],
  );
  const labSuggestions = useMemo(
    () => (eoLabs ? eoLabs.map((l) => l.lab_name) : [...new Set(ctx.recentLabs)]),
    [eoLabs, ctx.recentLabs],
  );
  const [labName, setLabName] = useState(initial?.labName ?? labSuggestions[0] ?? "");

  // 환자 — 공용 픽커(상담카드 환자 연결과 동일 형식)
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [editPatientName, setEditPatientName] = useState(initial?.patientName ?? ""); // 수정 모드 기존 환자 표시

  // 공통 필드
  const [doctor, setDoctor] = useState(initial?.doctor ?? "");
  const [hygienist, setHygienist] = useState(initial?.hygienist ?? "");
  const [orderDate, setOrderDate] = useState(initial?.orderDate || todayStr());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [orderType, setOrderType] = useState<"의뢰" | "수정" | "재제작">(initial?.orderType ?? "의뢰");
  const [remakeReason, setRemakeReason] = useState(initial?.remakeReason ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");

  // 양식
  const pickForm = (forms: LabOrderFormRow[], lab: string) =>
    forms.find((f) => f.lab_name === lab) ?? forms.find((f) => !f.lab_name);
  const [formId, setFormId] = useState(
    initial?.formId || (pickForm(ctx.forms, labName)?.id ?? ctx.forms[0]?.id ?? ""),
  );
  const form = useMemo(
    () => ctx.forms.find((f) => f.id === formId) ?? ctx.forms[0] ?? null,
    [ctx.forms, formId],
  );

  // 기공물(장) 배열 — 세트
  const [items, setItems] = useState<ItemState[]>(initial?.items?.length ? initial.items : [newItem()]);
  const setItem = (idx: number, patch: Partial<ItemState>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const setItemValue = (idx: number, fieldId: string, v: unknown) =>
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, values: { ...it.values, [fieldId]: v } } : it)),
    );

  // 첨부(세트 공통)
  const [attachments, setAttachments] = useState<LabAttachmentMeta[]>(initial?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [teethOpen, setTeethOpen] = useState(false); // spec 037 — 치아 모형(2D·3D) 스냅샷에 그려 첨부
  // 첨부 미리보기: path → 주소(이번에 올린 건 로컬 주소, 기존 첨부는 10분 서명 URL — 화면 표시용, 저장 안 함)
  const [previews, setPreviews] = useState<Record<string, string>>({});
  // 첨부 수정(그리기 엔진) — 대상 위치 + 바탕(원본)·편집용 기록(있으면 예전 표시를 층으로 복원)
  const [editTarget, setEditTarget] = useState<{
    index: number;
    image: Blob | null;
    doc: DrawDoc | null;
    ref: string;
  } | null>(null);

  // 수정 화면으로 연 기존 첨부의 미리보기 주소 받기
  useEffect(() => {
    const paths = (initial?.attachments ?? []).map((a) => a.path);
    if (paths.length === 0) return;
    let alive = true;
    void getLabAttachmentPreviewUrls(paths).then((r) => {
      if (alive && r.ok) setPreviews((prev) => ({ ...r.urls, ...prev }));
    });
    return () => {
      alive = false;
    };
  }, [initial?.attachments]);

  const handleLabChange = (name: string) => {
    setLabName(name);
    const f = pickForm(ctx.forms, name);
    if (f && !editing) setFormId(f.id);
  };

  // ── 첨부 업로드(서명 업로드 URL — 액션 바디 한도 우회) ──
  /** replaceAt를 주면 그 자리의 첨부를 새 파일로 바꾼다(수정) */
  /** 첨부 목록에 넣지 않고 저장소에만 올린다(그림의 원본·편집용 기록) → 경로 */
  const putFile = async (blob: Blob, name: string): Promise<string | null> => {
    const prep = await createLabAttachmentUpload(setIdRef.current, name, "sketch", blob.size);
    if (!prep.ok) {
      setMsg(prep.message);
      return null;
    }
    const { error } = await createBrowserSupabaseClient()
      .storage.from(labBucket)
      .uploadToSignedUrl(prep.path, prep.token, blob, { contentType: blob.type || "application/octet-stream" });
    if (error) {
      setMsg(`업로드 실패: ${error.message}`);
      return null;
    }
    return prep.path;
  };

  const uploadBlob = async (blob: Blob, name: string, kind: LabAttachmentKind, replaceAt?: number, draw?: string) => {
    const replaced = replaceAt !== undefined ? (attachments[replaceAt]?.bytes ?? 0) : 0;
    const total = attachments.reduce((s, a) => s + a.bytes, 0) - replaced + blob.size;
    if (total > LAB_ATTACH_LIMITS.total) {
      setMsg("첨부 합계가 100MB를 초과합니다 — 일부를 빼 주세요.");
      return;
    }
    setUploading(true);
    setMsg("");
    try {
      const prep = await createLabAttachmentUpload(setIdRef.current, name, kind, blob.size);
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
      const meta: LabAttachmentMeta = { kind, name, bytes: blob.size, path: prep.path, ...(draw ? { draw } : {}) };
      setPreviews((prev) => ({ ...prev, [prep.path]: URL.createObjectURL(blob) }));
      setAttachments((prev) =>
        replaceAt !== undefined && replaceAt < prev.length ? prev.map((a, i) => (i === replaceAt ? meta : a)) : [...prev, meta],
      );
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

  /** 그리기 결과 저장 — 원본(없던 것)·편집용 기록을 저장소에 두고, 보기용 그림을 첨부로 */
  const saveDrawing = async (r: DrawResult, kind: LabAttachmentKind, replaceAt?: number) => {
    setUploading(true);
    try {
      const doc: DrawDoc = { ...r.doc, base: { ...r.doc.base } };
      if (r.base && !doc.base.ref) {
        const ref = await putFile(r.base, `base_${Date.now()}.${r.base.type.split("/")[1] || "png"}`);
        if (ref) doc.base.ref = ref;
      }
      const draw = await putFile(
        new Blob([JSON.stringify(doc)], { type: "application/json" }),
        `drawing_${Date.now()}${DRAW_DOC_SUFFIX}`,
      );
      if (kind === "photo") {
        const compressed = await compressImageFile(r.file); // 사진은 다시 webp로(5MB 제한)
        await uploadBlob(compressed, compressed.name, "photo", replaceAt, draw ?? undefined);
      } else {
        await uploadBlob(r.file, `sketch_${Date.now()}.png`, "sketch", replaceAt, draw ?? undefined);
      }
    } finally {
      setUploading(false);
    }
  };

  /** 첨부(사진·그림)를 그리기 엔진으로 열기 — 편집용 기록이 있으면 원본 위에 예전 표시를 층으로 복원 */
  const openEdit = async (index: number) => {
    const a = attachments[index];
    if (!a) return;
    try {
      if (a.draw) {
        const r = await getLabAttachmentPreviewUrls([a.draw]);
        const url = r.ok ? r.urls[a.draw] : null;
        const doc = url ? upgradeDoc(await (await fetch(url)).json()) : null;
        if (doc) {
          let image: Blob | null = null;
          if (doc.base.ref) {
            const local = previews[doc.base.ref];
            const signed = local ? null : await getLabAttachmentPreviewUrls([doc.base.ref]);
            const baseUrl = local ?? (signed?.ok ? signed.urls[doc.base.ref] : null);
            if (baseUrl) image = await (await fetch(baseUrl)).blob();
          }
          if (image || doc.base.kind === "blank") {
            setEditTarget({ index, image, doc, ref: doc.base.ref ?? a.path });
            return;
          }
        }
      }
      // 기록이 없으면(예전 첨부) 지금 그림 위에 덧그리기 — 지금 그림이 원본
      const url = previews[a.path];
      if (!url) return;
      const blob = await (await fetch(url)).blob();
      setEditTarget({ index, image: blob, doc: null, ref: a.path });
    } catch {
      setMsg("첨부를 열지 못했습니다 — 잠시 뒤 다시 시도해 주세요.");
    }
  };

  const saveEdit = async (r: DrawResult) => {
    if (!editTarget) return;
    const { index } = editTarget;
    const a = attachments[index];
    setEditTarget(null);
    if (!a) return;
    await saveDrawing(r, a.kind === "photo" ? "photo" : "sketch", index);
  };

  const patientName = patient?.name ?? editPatientName.trim();
  const itemsReady = items.every((it) => it.prosthesis.trim());
  // 계약 ⓖ-2 — EO 목록이 살아 있는데 목록에 없는 기공소명이면 재선택을 강제(EO 400에 맡기지 않는다)
  const labInvalid =
    eoLabs !== null && labName !== "" && !eoLabs.some((l) => l.lab_name === labName);

  const submit = () => {
    setMsg("");
    startTransition(async () => {
      const r = await submitLabOrderSet({
        setId: setIdRef.current,
        labName,
        patientId: patient ? Number(patient.id) : (initial?.patientId ?? null),
        patientName,
        chartNo: patient?.chart_no ?? initial?.chartNo ?? undefined,
        doctor: doctor || undefined,
        hygienist: hygienist || undefined,
        orderDate,
        dueDate,
        orderType,
        remakeReason: remakeReason || undefined,
        formId: form?.id ?? "",
        instructions: instructions || undefined,
        attachments,
        items,
      });
      if (r.ok) onDone(r.message, r.status);
      else setMsg(r.message);
    });
  };

  return (
    <section className="space-y-5 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">
          {remake ? "재제작 의뢰" : editing ? "기공지 수정" : "새 기공지"}
        </h2>
        <button onClick={onCancel} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50">
          닫기
        </button>
      </div>

      {remake && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          이미 완료·청구된 의뢰는 수정할 수 없어 <b>재제작 의뢰(새 건 · 별도 청구)</b>로 보냅니다 —
          내용·첨부는 그대로 가져왔으니 재제작 사유를 적어주세요.
        </div>
      )}
      {editing && initial?.anySent && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          이미 전송된 기공지입니다 — 수정 내용은 수정본으로 다시 전송되며, 누가 언제 수정했는지
          이력이 남고 기공소에도 수정임이 표시됩니다.
        </div>
      )}
      {msg && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{msg}</div>}

      {/* 기공소 */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">기공소</label>
        {eoLabs ? (
          eoLabs.length > 0 || (editing && labName) ? (
            <>
              <select
                value={labName}
                onChange={(e) => handleLabChange(e.target.value)}
                className={fieldInputCls()}
              >
                {!labSuggestions.includes(labName) && labName && (
                  <option value={labName}>{labName} (포탈 설정 확인 필요)</option>
                )}
                {eoLabs.map((l) => (
                  <option key={l.lab_name} value={l.lab_name}>
                    {l.lab_name}
                  </option>
                ))}
              </select>
              {labInvalid ? (
                <p className="text-xs font-medium text-rose-600">
                  「{labName}」은(는) 현재 포탈 목록에 없습니다 — 목록에서 기공소를 다시 선택해야 보낼 수 있어요.
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  EO에서 포탈을 켠 기공소만 보입니다 — 새 기공소는 EO 기공소 포탈 설정에서 먼저 켜 주세요.
                </p>
              )}
            </>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              포탈이 켜진 기공소가 없습니다 — EO → 기공소 포탈 설정에서 기공소를 연결하고 켠 뒤 다시
              열어주세요.
            </p>
          )
        ) : (
          <>
            <input
              list="lab-suggestions"
              value={labName}
              onChange={(e) => handleLabChange(e.target.value)}
              placeholder="기공소 선택 또는 직접 입력"
              className={fieldInputCls()}
            />
            <datalist id="lab-suggestions">
              {labSuggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {labSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {labSuggestions.slice(0, 6).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleLabChange(n)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      labName === n
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400">
              목록은 지금까지 거래한 기공소 기준입니다 — 새 기공소는 EO 거래처명과 같게 입력해 주세요.
            </p>
          </>
        )}
      </div>

      {/* 환자 — 공용 픽커(상담카드 환자 연결과 동일: 즉시 검색 + 새 환자 등록) */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">환자</label>
        {patient || (editing && patientName) ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
            <span className="font-medium text-emerald-800">{patient?.name ?? patientName}</span>
            {(patient?.chart_no ?? initial?.chartNo) && (
              <span className="text-xs text-emerald-600">차트 {patient?.chart_no ?? initial?.chartNo}</span>
            )}
            <button
              onClick={() => {
                setPatient(null);
                setEditPatientName("");
              }}
              className="ml-auto text-xs text-emerald-600 hover:underline"
            >
              변경
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
            <PatientPicker onPick={(p) => setPatient(p)} />
          </div>
        )}
      </div>

      {/* 담당·날짜 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Dr. (진료 의사)</label>
          <input
            list="staff-doctors"
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            placeholder="선택 또는 입력"
            className={fieldInputCls()}
          />
          <datalist id="staff-doctors">
            {[...ctx.staff.filter((s) => s.role?.includes("원장")), ...ctx.staff.filter((s) => !s.role?.includes("원장"))].map(
              (s) => (
                <option key={s.name} value={s.name}>
                  {s.role ? `${s.name} (${s.role})` : s.name}
                </option>
              ),
            )}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">담당자 (작성자)</label>
          <input
            list="staff-all"
            value={hygienist}
            onChange={(e) => setHygienist(e.target.value)}
            placeholder="선택 또는 입력"
            className={fieldInputCls()}
          />
          <datalist id="staff-all">
            {ctx.staff.map((s) => (
              <option key={s.name} value={s.name}>
                {s.role ? `${s.name} (${s.role})` : s.name}
              </option>
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">의뢰일</label>
          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={fieldInputCls()} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">완료 희망(납기)일 *</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldInputCls()} />
          <div className="flex flex-wrap items-center gap-1">
            {[3, 7, 10].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDueDate(addDays(orderDate, d))}
                className={`rounded-full border px-2 py-0.5 text-xs transition ${
                  dueDate && dueDate === addDays(orderDate, d)
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                +{d}일
              </button>
            ))}
            <span className="mx-0.5" />
            <button
              type="button"
              onClick={() => dueDate && setDueDate(addDays(dueDate, -1))}
              disabled={!dueDate}
              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              −1일
            </button>
            <button
              type="button"
              onClick={() => setDueDate(dueDate ? addDays(dueDate, 1) : addDays(orderDate, 1))}
              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 transition hover:bg-slate-50"
            >
              +1일
            </button>
          </div>
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

      {/* 기공물(장) — 한 장 = 한 종류, [+ 추가]로 세트 구성 */}
      <div className="space-y-4">
        {items.map((it, idx) => (
          <div key={it.orderId} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                기공물 {idx + 1}
                <span className="ml-2 font-normal text-slate-400">{items.length > 1 ? `/ ${items.length}` : ""}</span>
              </h3>
              {!editing && items.length > 1 && (
                <button
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-500 hover:bg-rose-50"
                >
                  삭제
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">치식</label>
              <ToothChart selected={it.tooth} onChange={(next) => setItem(idx, { tooth: next })} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">보철 종류 *</label>
                <select
                  value={it.prosthesis}
                  onChange={(e) => {
                    const next = e.target.value;
                    // 보철 종류에 재료가 포함되면(Crown (Zirconia) 등) 재료 자동 채움 —
                    // 사용자가 직접 적은 재료는 건드리지 않는다(빈 값·직전 자동값일 때만 교체).
                    const auto = materialFromProsthesis(next);
                    const prevAuto = materialFromProsthesis(it.prosthesis);
                    const cur = (it.material ?? "").trim();
                    setItem(idx, {
                      prosthesis: next,
                      ...(auto && (cur === "" || cur === prevAuto) ? { material: auto } : {}),
                    });
                  }}
                  className={fieldInputCls()}
                >
                  <option value="">선택…</option>
                  {(form?.def.prosthesis_options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">재료</label>
                <input value={it.material ?? ""} onChange={(e) => setItem(idx, { material: e.target.value })} className={fieldInputCls()} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Shade</label>
                <div className="flex gap-2">
                  <select
                    value={it.shadeSystem ?? ""}
                    onChange={(e) => setItem(idx, { shadeSystem: e.target.value })}
                    className="w-44 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">체계…</option>
                    {(form?.def.shade_systems ?? []).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    value={it.shade ?? ""}
                    onChange={(e) => setItem(idx, { shade: e.target.value })}
                    placeholder="예: A2 / 치경부 A3"
                    className={fieldInputCls()}
                  />
                </div>
              </div>
            </div>

            {/* 동적 양식 — 데이터 정의 렌더(장별 값) */}
            {form &&
              form.def.sections.map((section) => (
                <details key={section.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">{section.title}</summary>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {section.fields.map((field) => {
                      const v = it.values[field.id];
                      return (
                        <div key={field.id} className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">
                            {field.label}
                            {field.unit ? ` (${field.unit})` : ""}
                          </label>
                          {field.type === "select" && (
                            <select value={(v as string) ?? ""} onChange={(e) => setItemValue(idx, field.id, e.target.value)} className={fieldInputCls()}>
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
                                const cur = (v as string[]) ?? [];
                                const on = cur.includes(o);
                                return (
                                  <button
                                    key={o}
                                    type="button"
                                    onClick={() => setItemValue(idx, field.id, on ? cur.filter((x) => x !== o) : [...cur, o])}
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
                              <input type="checkbox" checked={v === true} onChange={(e) => setItemValue(idx, field.id, e.target.checked)} />
                              해당
                            </label>
                          )}
                          {(field.type === "ea" || field.type === "number") && (
                            <input
                              type="number"
                              min={field.type === "ea" ? 0 : undefined}
                              value={(v as number) ?? ""}
                              onChange={(e) => setItemValue(idx, field.id, e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder={field.type === "ea" ? "EA" : undefined}
                              className={fieldInputCls()}
                            />
                          )}
                          {field.type === "date" && (
                            <input type="date" value={(v as string) ?? ""} onChange={(e) => setItemValue(idx, field.id, e.target.value)} className={fieldInputCls()} />
                          )}
                          {field.type === "textarea" && (
                            <textarea value={(v as string) ?? ""} onChange={(e) => setItemValue(idx, field.id, e.target.value)} rows={2} placeholder={field.hint} className={fieldInputCls()} />
                          )}
                          {field.type === "text" && (
                            <input value={(v as string) ?? ""} onChange={(e) => setItemValue(idx, field.id, e.target.value)} placeholder={field.hint} className={fieldInputCls()} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
          </div>
        ))}

        {!editing && (
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, newItem()])}
            className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
          >
            + 기공물 추가 (같은 세트로 함께 의뢰)
          </button>
        )}
      </div>

      {/* 계약 ⓐ-2 고지 — 042 동의 범위에 자유기재·첨부가 포함됨을 문구로 명시 */}
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        기타 주문사항과 사진·동영상·손그림은 기공소에 <b>그대로 전달</b>됩니다 — 환자 이름 등
        식별정보를 적거나 찍지 마세요.
      </p>

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

      {/* 첨부(세트 공통) */}
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
          <button type="button" onClick={() => setTeethOpen(true)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            🦷 치아 모형에 그리기
          </button>
          {uploading && <span className="text-xs text-slate-400">업로드 중…</span>}
        </div>
        {attachments.length > 0 && (
          <AttachmentGallery
            attachments={attachments}
            previews={previews}
            onRemove={(i) => setAttachments((prev) => prev.filter((_, j) => j !== i))}
            onEdit={(i) => void openEdit(i)}
          />
        )}
      </div>

      {/* 제출 */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          취소
        </button>
        <button
          onClick={submit}
          disabled={isPending || uploading || !labName.trim() || labInvalid || !patientName || !itemsReady || !dueDate}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {isPending
            ? "보내는 중…"
            : editing
              ? "수정본 보내기"
              : items.length > 1
                ? `기공소로 보내기 (${items.length}건)`
                : "기공소로 보내기"}
        </button>
      </div>

      {/* 그림 지시(빈 종이에 손그림) — 그리기 엔진 */}
      {sketchOpen && (
        <DrawEditor
          title="그림 지시 (손그림)"
          saveLabel="첨부에 담기"
          fileName="sketch"
          requireInk
          onClose={() => setSketchOpen(false)}
          onSave={(r) => {
            setSketchOpen(false);
            void saveDrawing(r, "sketch");
          }}
        />
      )}
      {/* 첨부 수정 — 그리기 엔진으로 열어 저장하면 그 자리의 첨부가 바뀐다(원본은 저장소에 그대로) */}
      {editTarget && (
        <DrawEditor
          image={editTarget.image}
          doc={editTarget.doc}
          base={{ ref: editTarget.ref }}
          title="첨부 고치기"
          saveLabel="수정 저장"
          onClose={() => setEditTarget(null)}
          onSave={(r) => void saveEdit(r)}
        />
      )}
      {/* 치아 모형(2D·3D)을 원하는 각도로 돌려 찍고 그 위에 그려 손그림 첨부로(전송 시 drawing) */}
      {teethOpen && (
        <ToothViewer
          doneLabel="첨부하기"
          onClose={() => setTeethOpen(false)}
          onDone={async (image, _text, drawing) => {
            setTeethOpen(false);
            // 그려서 담았으면 편집용 기록까지(나중에 고치기), 아니면 화면 그림만
            if (drawing) await saveDrawing(drawing, "sketch");
            else await uploadBlob(image, `teeth_${Date.now()}.png`, "sketch");
          }}
        />
      )}
    </section>
  );
}
