// spec 035 — 기공지 양식(데이터 정의)·전송 페이로드 타입과 지플란트 첫 시드.
// 양식은 코드가 아닌 데이터: 기공소마다 다른 양식을 lab_order_forms.def(jsonb)로 수용한다.
// EO는 form.values를 해석하지 않는다(카드 #1957 합의) — 표시는 form.display 스냅샷으로.

export type LabFormFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multi"
  | "check"
  | "number"
  | "date"
  | "ea"; // 수량(0 = 없음)

export type LabFormField = {
  id: string;
  label: string;
  type: LabFormFieldType;
  options?: string[];
  unit?: string;
  hint?: string;
};

export type LabFormSection = {
  id: string;
  title: string;
  fields: LabFormField[];
};

export type LabOrderFormDef = {
  key: string;
  prosthesis_options: string[];
  shade_systems: string[];
  sections: LabFormSection[];
};

export type LabOrderFormRow = {
  id: string;
  institution_id: string | null;
  lab_name: string | null;
  name: string;
  version: number;
  def: LabOrderFormDef;
  active: boolean;
};

/** EO 거래처(기공소) — 계약 §2-1(+ⓐ free_text·attachments). share ✗ 필드는 Carelog가 애초에 보내지 않는다. */
export type EoLabShare = {
  patient_name: boolean;
  chart_no: boolean;
  doctor: boolean;
  free_text?: boolean; // ⓐ — false면 instructions(기타 주문사항)를 아예 안 보냄
  attachments?: boolean; // ⓐ — false면 첨부를 아예 안 보냄
};
export type EoLab = {
  lab_name: string;
  portal_enabled: boolean;
  share: EoLabShare;
  shade_system?: string | null;
};

export type LabAttachmentKind = "photo" | "video" | "sketch";
export type LabAttachmentMeta = {
  kind: LabAttachmentKind;
  name: string;
  bytes: number;
  path: string; // lab-orders 비공개 버킷 내 경로(서명 URL은 전송 시점 생성)
  /** spec 039 — 그린 첨부의 편집용 기록(.draw.json) 경로. Carelog 내부용(EO로 보내지 않음 — 전송기가 kind·name·bytes만 싣는다) */
  draw?: string;
};

/** 용량 제한(카드 #1957 합의): 사진 5MB · 동영상 50MB/30초 · 건당 합계 100MB */
export const LAB_ATTACH_LIMITS = {
  photo: 5 * 1024 * 1024,
  sketch: 5 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  videoSeconds: 30,
  total: 100 * 1024 * 1024,
} as const;

export type LabDisplayRow = { section?: string; label: string; value: string };

/** form.values + 양식 정의 → 사람용 표시 스냅샷(순서 보존). EO·기공소는 이것만 렌더한다. */
export function buildFormDisplay(
  def: LabOrderFormDef,
  values: Record<string, unknown>,
): LabDisplayRow[] {
  const rows: LabDisplayRow[] = [];
  for (const section of def.sections ?? []) {
    for (const field of section.fields ?? []) {
      const v = values[field.id];
      let text = "";
      if (v === undefined || v === null || v === "") continue;
      switch (field.type) {
        case "check":
          if (v !== true) continue;
          text = "✓";
          break;
        case "ea": {
          const n = Number(v);
          if (!n) continue;
          text = `${n} EA`;
          break;
        }
        case "multi":
          if (!Array.isArray(v) || v.length === 0) continue;
          text = v.join(", ");
          break;
        case "number":
          text = `${v}${field.unit ? ` ${field.unit}` : ""}`;
          break;
        default:
          text = String(v);
      }
      rows.push({ section: section.title, label: field.label, value: text });
    }
  }
  return rows;
}

// ── 첫 양식 시드 — 지플란트 기공지 실물(EO spec-138 핸드오버 §3, 2026-10-20 사진) ──
// 다른 기공소는 다른 양식이 된다. 내용이 바뀌어도 코드는 안 바뀐다(데이터 정의).
export const DEFAULT_LAB_FORM_NAME = "기본 기공의뢰서 (지플란트 실물 기반)";
export const DEFAULT_LAB_FORM_DEF: LabOrderFormDef = {
  key: "default-v1",
  prosthesis_options: [
    "Crown (PFM)",
    "Crown (Zirconia)",
    "Crown (Gold)",
    "Implant Crown",
    "Custom Abutment",
    "Inlay/Onlay",
    "Laminate",
    "Denture",
    "Bridge",
    "기타(기타 주문사항에 기재)",
  ],
  shade_systems: ["VITA classical", "VITA 3D-Master", "기타"],
  sections: [
    {
      id: "custom",
      title: "Custom (임플란트)",
      fields: [
        { id: "implant_brand", label: "Implant 종류(회사)", type: "text", hint: "예: 오스템, 스트라우만" },
        { id: "hex", label: "Hex 여부", type: "select", options: ["Hex", "Non-hex"] },
        { id: "margin_type", label: "Margin", type: "select", options: ["Supra", "EQ", "Sub"] },
        { id: "margin_mm", label: "Margin 깊이", type: "number", unit: "mm" },
      ],
    },
    {
      id: "crown",
      title: "Crown",
      fields: [
        { id: "crown_type", label: "보철 Type", type: "select", options: ["Screw", "Cement", "SCRP"] },
        {
          id: "hook",
          label: "Hook 위치",
          type: "multi",
          options: ["Buccal 근심", "Buccal 원심", "Lingual 근심", "Lingual 원심"],
        },
      ],
    },
    {
      id: "checklist",
      title: "치과 체크리스트 (동봉물)",
      fields: [
        { id: "ea_imp", label: "imp", type: "ea" },
        { id: "ea_antagonist", label: "대합치", type: "ea" },
        { id: "ea_bite", label: "bite", type: "ea" },
        { id: "ea_gold", label: "gold", type: "ea" },
        { id: "ea_coping", label: "coping", type: "ea" },
        { id: "ea_healing", label: "healing", type: "ea" },
      ],
    },
  ],
};

// ── 치식(FDI) — 치식도 UI용 ──
export const FDI_UPPER = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
export const FDI_LOWER = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"];
