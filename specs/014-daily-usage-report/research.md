# Research: 일일 사용 리포트 (spec 014)

## 기존 인프라 재사용
- **Cron**: `vercel.json` crons 배열 + `CRON_SECRET` Bearer(기존 sync-master·prune-audio 패턴). UTC 스케줄 → 08:00 KST = `0 23 * * *`.
- **알림**: spec 012 `sendNotification`(알림함 적재 + 웹푸시 통합). recipients='이메일'이면 인앱만(푸시 없음) → 슈퍼어드민 푸시는 신규 `sendPushToUser` 추가.
- **데이터**: spec 013 `menu_usage_daily`(KST 일자) + `credit_log`(timestamptz).

## 결정
- **하루 경계 = KST 0~24시**. menu는 day 컬럼(이미 KST), credit은 `${date}T00:00:00+09:00` 기준 24h 윈도우.
- **발송 시각 = 08:00 KST**, 대상 = **전일 완료된 하루**(깔끔한 마감 집계).
- **토큰 = Claude 실토큰 + 크레딧 둘 다**. Whisper는 토큰 없음 → 전사 건수. credit_log에 tokens_in/out 추가가 최소 침습(별도 테이블 불필요).
- **슈퍼어드민은 크로스-기관** → 인앱 카드는 본인 소속 기관(들)에 recipients=email로 적재(다른 사용자에게 안 보임), 푸시는 user 단위.
- **스냅샷 영속(usage_reports)** — 이력·불변·멱등. 즉석 집계는 폴백(과거 임의일·당일 미발행 열람).

## 범용성 (후속)
- `buildDailyReport({scope})`가 institution_id를 받으므로, 운영자(기관 관리자)용 리포트는 cron에서 기관 루프 + `sendNotification(recipients:'admins')`만 추가하면 재사용 가능.
- 이메일 채널은 운영자 배포 시 검토(SMTP/Resend 등 신규 연동 필요).
