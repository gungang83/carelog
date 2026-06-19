/**
 * 이 탭(브라우저 인스턴스)이 방금 저장한 상담 id를 기억한다.
 * 실시간 알림(live-alerts-provider)에서 "내가 방금 저장한 기록"의 토스트·소리만
 * 숨기기 위함 — actor_user_id 기준이 아니라 탭 기준이라, **같은 계정으로 다른 기기**에
 * 로그인한 화면은 정상적으로 알림을 받는다.
 */
const localSaves = new Set<string>();

export function markLocalSave(consultationId: string): void {
  if (!consultationId) return;
  localSaves.add(consultationId);
  // 알림은 수 초 내 도착하므로 잠시 후 정리(메모리 누수 방지)
  setTimeout(() => localSaves.delete(consultationId), 60_000);
}

export function wasLocalSave(consultationId: string | null | undefined): boolean {
  return !!consultationId && localSaves.has(consultationId);
}
