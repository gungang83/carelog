# Contract: 음성 보관 액션 · 재청취 UI · 정리 cron

웹앱이므로 (a) Server Action 계약, (b) 재청취 UI 계약, (c) cron 계약.

## A. Server Actions (app/actions/audio.ts)

### uploadConsultationAudio
```
uploadConsultationAudio(consultationId: string, formData: FormData /* audio blob */)
  : Promise<{ ok: true } | { ok: false; message: string }>
```
- 호출자 기관 == consultation.institution_id 검증. 비공개 버킷 `{institution_id}/{consultationId}.webm` 업로드(upsert).
- `consultation.audio_path`·`audio_uploaded_at` 갱신.
- plan=free면 업로드 직후 **롤링 정리**(4번째 이후 파일+audio_path 제거).
- 실패는 비차단(텍스트 저장 이미 완료). 결과 {ok,message}.

### getConsultationAudioUrl
```
getConsultationAudioUrl(consultationId: string)
  : Promise<{ ok: true; url: string; expiresIn: number }
          | { ok: false; reason: 'expired'|'not_stored'|'forbidden'|'error'; message: string }>
```
- 권한: 호출자 기관 == consultation 기관 + 활성 직원.
- 보존 판정: free=audio_path 존재(롤링 생존분) / standard=업로드 90일 내 / pro·ent=365일+ 내. 만료·미보관이면 `expired`/`not_stored`.
- 통과 시 `createSignedUrl(audio_path, 60)` 발급. pro/enterprise면 `audio_replay_logs` insert(감사).
- 공개 URL 미발급(서명 URL만).

## B. 재청취 UI (components/chair/audio-replay-button.tsx)
```
props: { consultationId: string }
```
- 클릭 → `getConsultationAudioUrl` 호출 → ok면 `<audio src=signedUrl autoplay controls>` 표시/재생.
- 실패 사유별 안내(FR-013): expired="보관 기간이 지나 들을 수 없어요" / not_stored="저장된 음성이 없어요" / forbidden·error 일반 안내.
- 배치: 미연결기록 카드·상담이력 항목(음성 보유 시 노출). 권한 없으면 버튼 미노출(서버가 사유 반환).

## C. 정리 cron (app/api/cron/prune-audio/route.ts)
```
GET /api/cron/prune-audio   (Vercel Cron, 일 1회, CRON_SECRET Bearer)
  → { ok: true, pruned: number } | { ok:false, error }
```
- 등급별 만료 audio 조회(standard>90일, pro/ent>365일; free>최근3) → Storage 파일 삭제 + audio_path/audio_uploaded_at null.
- 텍스트 불변. 기관 격리. admin(service role).

## 불변/회귀 금지
- 기존 이미지 버킷(public)·상담 저장·실시간 알림 회귀 없음.
- 재청취 감사는 chair_audit_logs 미사용(realtime 오발 방지) → audio_replay_logs.
