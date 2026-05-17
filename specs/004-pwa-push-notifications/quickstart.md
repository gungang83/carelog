# Quickstart: PWA + 푸시 알림 테스트 시나리오

## 환경 준비

```bash
# 1. VAPID 키 생성
npx web-push generate-vapid-keys

# 2. .env.local에 추가
VAPID_PUBLIC_KEY=<생성된 공개키>
VAPID_PRIVATE_KEY=<생성된 비밀키>
VAPID_SUBJECT=mailto:admin@carelog.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<생성된 공개키>

# 3. Vercel에도 동일하게 추가
npx vercel env add VAPID_PUBLIC_KEY production
npx vercel env add VAPID_PRIVATE_KEY production
npx vercel env add VAPID_SUBJECT production
npx vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production
```

## 시나리오 1: PWA 설치

1. Chrome 또는 Safari (iOS 16.4+)에서 Carelog 접속
2. 주소 표시줄 또는 공유 버튼에서 "홈 화면에 추가" 선택
3. 설치 후 홈 화면 아이콘 탭 → 전체 화면 실행 확인
4. 주소 표시줄 없이 Carelog 메인 화면 표시 확인

## 시나리오 2: 항시 로그인 확인

1. 로그인 후 앱 종료
2. 24시간 후 재실행
3. 로그인 화면 없이 바로 메인 화면 표시 확인

## 시나리오 3: 푸시 알림 수신

1. 홈 화면에서 "알림 받기" 배너 클릭
2. 브라우저 알림 권한 허용
3. 다른 기기/계정으로 상담 기록 저장
4. 5초 이내 기기 푸시 알림 도착 확인
5. 알림 탭 → 해당 환자 상담 기록 화면 이동 확인

## 시나리오 4: 헤더 새로고침

1. 환자 목록 화면에서 다른 기기로 새 환자 등록
2. 헤더 새로고침 버튼(↻) 탭
3. 새 환자가 목록에 표시 확인

## 시나리오 5: 푸터 확인

1. 홈, 환자 목록, 설정 등 주요 페이지 하단 스크롤
2. "SUWANT holdings Inc." 푸터 텍스트 표시 확인

## 시나리오 6: 알림 구독 해제

1. 설정 화면 → "알림 관리" 섹션
2. "알림 해제" 버튼 클릭
3. 이후 상담 기록 저장 시 해당 기기로 알림 미발송 확인
