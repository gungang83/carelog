🦷 프로젝트명: 덴탈 오큐 (Carelog Record)

마지막 업데이트: 2026-04-03 (최종 해결 완료)
담당: 송정현 대표님 & 구비서(Gemini)

1. 프로젝트 개요

치과 진료실에서 상담 내용을 기록하고, 사진 및 제품 처방을 포함하여 환자에게 디지털 리포트를 전달하는 서비스.

2. 현재 기술 스택

Frontend: Next.js (App Router), Tailwind CSS

Database: Supabase (Table: patient, consultation)

Storage: Supabase Storage (Bucket: consultation-images)

3. 구현된 기능 (Completed)

[x] 환자 검색 및 신규 등록: 소문자 patient 테이블 연동 완료.

[x] 상담 내용 및 이미지 업로드: consultation 테이블 및 Storage 연동 완료.

[x] 결함 해결 (CRITICAL): 검색 결과 클릭 시 undefined ID 전달 및 404 에러 완벽 해결.

[x] 처방 UI 구현: 칫솔, 치약 등 판매 제품 클릭형 선택 인터페이스 구현 및 prescriptions 필드 저장 로직 완료.

[x] 데이터 타입 정밀 점검: Supabase bigint와 URL params 간의 타입 매칭 성공.

4. 진행 예정 사항 (Backlog)

[ ] 과거 내역 타임라인: 환자 상세 페이지 하단에 이전 상담 이력을 시간순으로 출력.

[ ] 환자용 모바일 뷰어: 전용 링크 생성 및 리포트 페이지 (/view/[id]).

[ ] 알림 전송 기능: 카카오 알림톡/문자 API 연동하여 상담 리포트 링크 발송.

🤖 구비서(AI)를 위한 작업 가이드

데이터 정합성: 모든 테이블 명은 소문자(patient, consultation)를 고수할 것.

Next.js 15+ 대응: params는 항상 await를 사용하는 최신 컨벤션을 유지할 것.

UI 디자인: 예미안치과의 신뢰감을 주는 'Clean Blue & White' 테마를 유지하며, 태블릿 터치 환경을 최우선으로 고려할 것.