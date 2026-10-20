"use client";

// 상담카드 환자 연결 — 공용 PatientPicker(검색+새 환자 등록)로 고른 환자를 기록에 연결한다.
// (픽커 추출: spec 035 기공지와 형식 공유 — 대표 지시 2026-10-20)

import { useState, useTransition } from "react";
import { linkChairRecordToPatient } from "@/app/actions/chairs";
import { PatientPicker, type PickedPatient } from "@/components/patients/patient-picker";

interface ChairPatientSearchProps {
  consultationId: string;
  onLinked: () => void;
  onCancel: () => void;
}

export function ChairPatientSearch({
  consultationId,
  onLinked,
  onCancel,
}: ChairPatientSearchProps) {
  const [linking, startLink] = useTransition();
  const [error, setError] = useState("");

  const handlePick = (patient: PickedPatient) => {
    setError("");
    startLink(async () => {
      const result = await linkChairRecordToPatient({
        consultationId,
        patientId: patient.id,
      });
      if (result.ok) onLinked();
      else setError(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <PatientPicker onPick={handlePick} onCancel={onCancel} busy={linking} busyLabel="연결 중…" />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
