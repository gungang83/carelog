🦷 프로젝트명: carelog

마지막 업데이트: 2026-04-05
담당: 송정현 대표님 & 구비서(Gemini)

1. 프로젝트 현황 (Current Status)

배포 주소: https://carelog-tau.vercel.app

최근 작업: 모바일 환경에서 고화질 이미지 업로드 시 발생하는 Vercel 서버 타임아웃(10초) 해결을 위해 클라이언트 단(브라우저) 이미지 압축 및 리사이징 로직 적용.

2. 기술 스택 (Tech Stack)

Frontend: Next.js (App Router), Tailwind CSS, shadcn/ui

Backend/DB: Supabase (Table: patient, consultation)

Storage: Supabase Storage (Bucket: consultation-images)

Deployment: GitHub + Vercel (CI/CD 자동화 완료)

3. 구현 완료 사항 (Completed)

[x] 환자 관리: 이름 검색 및 신규 환자 등록 기능 (ID 타입 불일치 및 404 에러 해결).

[x] 상담 기록: 텍스트 및 다중 이미지 업로드 기능.

[x] 제품 처방(Prescription): 칫솔, 치약 등 관리 용품 클릭 선택 및 jsonb 데이터 저장 UI.

[x] 모바일 최적화: Safari 등 모바일 브라우저 대응 및 업로드 전 이미지 압축 로직 추가.

[x] 배포 환경: Vercel을 통한 실시간 웹 서비스 배포 및 환경 변수(ENV) 설정 완료.

4. 진행 예정 사항 (Backlog)

[ ] 상담 이력 타임라인: 환자 상세 페이지 하단에 과거 상담 기록을 날짜순으로 나열.

[ ] 환자용 리포트 뷰어: 환자가 카톡 링크로 접속했을 때 보는 깔끔한 전용 결과 페이지 (/view/[id]).

[ ] 알림톡/문자 연동: 상담 완료 시 자동으로 환자에게 리포트 링크 발송 기능.

🤖 구비서(AI) 가이드

모든 파일 수정 및 기능 추가 시 carelog라는 프로젝트 명칭을 고수할 것.

DB 테이블명은 항상 소문자(patient, consultation)를 사용할 것.

새로운 코드를 push하면 Vercel에서 자동으로 배포되므로, 빌드 에러가 없는지 항상 확인할 것.

디자인은 'Clean Blue & White' 테마를 유지하며 태블릿/모바일 터치 편의성을 최우선으로 할 것.