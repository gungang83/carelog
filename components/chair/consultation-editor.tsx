"use client";

import { forwardRef } from "react";
import type { ChairRow, ClinicMemberRow, Participant } from "@/lib/types/database";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";
import { PrescriptionPicker } from "@/components/chair/prescription-picker";
import { ParticipantPicker } from "@/components/chair/participant-picker";

/**
 * 상담 입력·편집 공용 에디터 — 모든 진입점(홈 보드·홈 피드 미연결/연결·환자 페이지)이
 * 같은 필드 세트를 쓰도록 통일한다. 본문·처방은 항상, 체어·참여자는 맥락에 따라
 * (props 제공 시) 노출한다. 상태는 호출자가 보유(제어 컴포넌트).
 *
 * - 체어 칩: chairs + onChairChange 가 모두 있을 때만 노출
 * - 참여자 피커: members + onParticipantsChange 가 모두 있을 때만 노출
 */
export type ConsultationEditorProps = {
  content: string;
  onContentChange: (value: string) => void;
  placeholder?: string;
  prescriptions: string[];
  onPrescriptionsChange: (value: string[]) => void;
  // 체어 (옵션)
  chairs?: ChairRow[];
  chairId?: string;
  onChairChange?: (chairId: string) => void;
  // 참여자 (옵션)
  members?: ClinicMemberRow[];
  recent?: Participant[];
  me?: Participant | null;
  participants?: Participant[];
  onParticipantsChange?: (participants: Participant[]) => void;
};

export const ConsultationEditor = forwardRef<RichTextEditorHandle, ConsultationEditorProps>(
  function ConsultationEditor(props, ref) {
    const showChair = !!props.chairs && !!props.onChairChange;
    const showParticipants = !!props.members && !!props.onParticipantsChange;

    return (
      <div className="flex flex-col gap-3">
        <RichTextEditor
          ref={ref}
          value={props.content}
          onChange={props.onContentChange}
          placeholder={props.placeholder ?? "상담 내용을 입력하세요…"}
        />

        {showChair && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500">체어</p>
            <div className="flex flex-wrap gap-1.5">
              {props.chairs!.map((c) => {
                const active = props.chairId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => props.onChairChange!(c.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-sky-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showParticipants && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500">참여자</p>
            <ParticipantPicker
              members={props.members!}
              recent={props.recent ?? []}
              me={props.me ?? null}
              value={props.participants ?? []}
              onChange={props.onParticipantsChange!}
            />
          </div>
        )}

        <PrescriptionPicker
          value={props.prescriptions}
          onChange={props.onPrescriptionsChange}
        />
      </div>
    );
  },
);
