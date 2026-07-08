"use client";

import { useState } from "react";
import type { PatientRecordItem } from "@/app/actions/patient-portal";
import { optimizeContentHtml, optimizeStorageUrl } from "@/lib/image/optimize";
import { stripMarkdownMarkers } from "@/lib/summary-format";

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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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
        const preview = stripHtml(record.content);
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
                    {preview || "(내용 없음)"}
                  </p>
                </div>
                <span className="text-slate-400 text-sm flex-shrink-0">
                  {isOpen ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-4">
                <div
                  className="text-sm text-slate-700 leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_img]:max-w-full [&_img]:rounded-lg [&_img]:mt-2"
                  dangerouslySetInnerHTML={{ __html: optimizeContentHtml(stripMarkdownMarkers(record.content)) }}
                />

                {record.prescriptions.length > 0 && (
                  <div>
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
                            src={optimizeStorageUrl(url, { width: 300 })}
                            loading="lazy"
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
