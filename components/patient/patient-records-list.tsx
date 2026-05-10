"use client";

import { useState } from "react";
import type { PatientRecordItem } from "@/app/actions/patient-portal";

type Props = {
  records: PatientRecordItem[];
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function PatientRecordsList({ records }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (records.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        아직 연결된 상담 내역이 없습니다.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {records.map((record) => {
        const isOpen = expandedId === record.consultationId;
        return (
          <li
            key={record.consultationId}
            className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden"
          >
            <button
              onClick={() =>
                setExpandedId(isOpen ? null : record.consultationId)
              }
              className="w-full px-5 py-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                      {record.institutionName}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(record.date)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 line-clamp-2">
                    {record.content}
                  </p>
                </div>
                <span className="text-slate-400 text-sm flex-shrink-0">
                  {isOpen ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
                <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4">
                  {record.content}
                </p>

                {record.prescriptions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      처방 메모
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {record.prescriptions.map((p, i) => (
                        <li key={i} className="text-sm text-slate-700">
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {record.imageUrls.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      첨부 사진
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {record.imageUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={url}
                            alt={`사진 ${i + 1}`}
                            className="h-24 w-24 rounded-lg object-cover border border-slate-200"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
