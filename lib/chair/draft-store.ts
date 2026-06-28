import type { Participant } from "@/lib/types/database";

/**
 * 상담보드 임시저장 스토어 (C-01 2차 · 녹음/작성 유실 복구 안전망).
 *
 * record-first 보드의 DRAFT 세션은 한 번에 하나라, 단일 키("current")로 관리한다.
 * 녹음 blob과 작성 내용을 IndexedDB에 주기 저장 → 탭이 닫혀 메모리가 날아가도
 * 재진입 시 복구. 저장/버리기 시 비운다.
 *
 * IndexedDB 미지원·사생활 모드 등에서는 조용히 실패(녹음·저장 흐름엔 영향 없음).
 */

const DB_NAME = "carelog-board";
const STORE = "draft";
const KEY = "current";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24시간 지난 임시본은 폐기

export type BoardDraft = {
  content: string;
  prescriptions: string[];
  participants: Participant[];
  selectedChair: { id: string; name: string } | null;
  audioBlob: Blob | null;
  // 청크(긴 상담) 모드: 분할 녹음 구간 blob 배열(복구 시 재전사용). 단일 blob과 병존.
  audioSegments?: Blob[] | null;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraft(draft: BoardDraft): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(draft, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // 무시 — 임시저장 실패가 본 기능을 막지 않는다.
  }
}

export async function loadDraft(): Promise<BoardDraft | null> {
  try {
    const db = await openDb();
    const draft = await new Promise<BoardDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as BoardDraft | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!draft) return null;
    if (Date.now() - draft.savedAt > MAX_AGE_MS) {
      await clearDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // 무시
  }
}

/** 복구할 만한 내용이 있는지 — 빈 임시본은 복구 제안하지 않는다. */
export function draftHasContent(d: BoardDraft | null): d is BoardDraft {
  return (
    !!d &&
    (d.content.trim() !== "" ||
      d.audioBlob !== null ||
      (d.audioSegments?.length ?? 0) > 0)
  );
}
