# Quickstart: 환자 앱 주요 시나리오 테스트

**Feature**: 005-patient-app

---

## 시나리오 1: SMS 링크 → OTP 인증 → Google 가입 완료

**전제조건**: 직원이 환자 상세 페이지에서 "상담 공유" 버튼을 눌러 SMS가 발송된 상태.

```
1. 브라우저에서 /p/<invitation_token> 접속
   예상: 기관명, 환자명, "주민번호+전화번호 입력" 폼 표시

2. 주민번호 앞자리 6자리 + 뒷자리 7자리 + 전화번호 입력 → "다음" 클릭
   예상: OTP 발송 완료 화면 (phone 번호 표시)

3. /portal/verify 페이지에서 수신한 6자리 OTP 입력 → "확인" 클릭
   예상: /portal/signup-cta 로 리디렉션

4. /portal/signup-cta 페이지
   예상: 오늘의 상담 내역 미리보기 + "Google로 가입하기" 버튼 표시

5. "Google로 가입하기" 클릭 → Google 계정 선택 → 동의
   예상: /auth/patient-callback 거쳐 /portal/records 로 리디렉션

6. /portal/records 페이지
   예상: 연결된 모든 기관의 상담 내역 날짜 역순으로 표시
```

**검증 포인트**:
- `patient_auth_links` 테이블에 (auth_user_id, patient_account_id, 'google') 행 생성 확인
- `patient_session_token` 쿠키 또는 Supabase 세션으로 `/portal/records` 접근 가능 확인

---

## 시나리오 2: 재방문 환자 — Google 로그인으로 즉시 접근

**전제조건**: 시나리오 1 완료 상태 (Google 계정 연결됨).

```
1. /portal/login 접속
   예상: OTP 로그인 폼 + "Google로 로그인" 버튼 표시

2. "Google로 로그인" 클릭 → Google 계정 선택 → 동의
   예상: /auth/patient-callback → /portal/records 리디렉션 (OTP 입력 없음)

3. /portal/records 표시
   예상: 이전 세션과 동일한 기록 목록
```

---

## 시나리오 3: 직원 → 환자 앱 전환 (이중 역할)

**전제조건**: 직원 계정(mobys0416@gmail.com)으로 대시보드 로그인 상태. 동일 이메일로 patient_auth_links 연결 완료.

```
1. 직원 대시보드 헤더에서 "내 진료 기록" 클릭
   예상: Google OAuth 흐름 시작 (이미 로그인된 경우 자동 통과)

2. /auth/patient-callback → patient_auth_links 확인 → /portal/records 리디렉션
   예상: 본인 진료 기록 표시

3. /portal/records 헤더의 "직원 화면으로" 링크 클릭
   예상: / (직원 대시보드) 으로 이동
```

---

## 시나리오 4: 새 상담 기록 → 환자 푸시 알림

**전제조건**: 환자가 `/portal/records`에서 푸시 알림 허용 + `patient_push_subscriptions` 등록 완료.

```
1. 직원 대시보드에서 해당 환자의 새 상담 기록 저장
   예상: 저장 성공 (직원 UI 기준)

2. 환자 기기에서 5초 이내 푸시 알림 수신
   예상: 알림 제목 "새 진료 기록", 내용 "환자명 — 상담내용 미리보기"

3. 알림 탭
   예상: 앱이 열리며 해당 상담 기록으로 이동 (/portal/records#consultation-<id>)
```

---

## 시나리오 5: SMS 링크 만료 후 접근

```
1. 72시간이 지난 /p/<token> 접속
   예상: "링크가 만료되었습니다. 치과에 재전송을 요청하세요." 메시지
          + /portal/login 바로가기 링크

2. /portal/login 에서 Google 로그인 시도 (이미 가입한 경우)
   예상: 정상적으로 /portal/records 접근
```

---

## DB 검증 쿼리 (Supabase 대시보드 또는 psql)

```sql
-- 환자 인증 링크 확인
SELECT pal.*, pa.rrn_hash
FROM patient_auth_links pal
JOIN patient_accounts pa ON pa.id = pal.patient_account_id
WHERE pal.provider = 'google'
ORDER BY pal.created_at DESC
LIMIT 10;

-- 환자 push 구독 확인
SELECT * FROM patient_push_subscriptions
ORDER BY created_at DESC
LIMIT 10;

-- 환자 계정 + 연결 기관 확인
SELECT pa.id, pa.rrn_hash, pal2.institution_id, i.name
FROM patient_accounts pa
JOIN patient_account_links pal2 ON pal2.patient_account_id = pa.id
JOIN institutions i ON i.id = pal2.institution_id
ORDER BY pa.created_at DESC;
```
