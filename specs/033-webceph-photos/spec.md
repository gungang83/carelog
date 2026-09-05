# spec 033 — WebCeph 연동: 환자 사진을 상담보드로

> 상태: **설계 완료 · 파트너 키 대기.** 대표 확정 2026-09-05 "진행해보자".
> 착수 게이트 = 어셈블서클 파트너십(Partner API Key + 상세 기술문서). 문의 초안: `partner-inquiry.md`.
> 조사 근거: `specs/000-backlog/webceph-patient-photos.md` (2026-09-05 다온).

## 1. 목표 UX

환자가 연결된 상담에서 픽커 '📚 자료'에 **[환자 사진] 탭** 추가:
WebCeph에 올라간 그 환자의 촬영 기록(파노라마·세팔로·구강사진) 목록 → 클릭 →
본문 삽입 또는 스테이지로 크게 열어 그리며 설명 → '기록에 담기'.

```
덴트웹 사진 → [WebCeph 공식 플러그인, 병원 조작] → WebCeph
            → [파트너 API, Carelog 서버 프록시] → 픽커 [환자 사진] 탭
```

## 2. 확인된 API 계약 (공개 문서 기준 — 상세는 파트너 문서로 보강)

- 기능: status · 사용자 정보 · 환자 목록(최신 10, 이름/ID 검색) · 환자별 기록 목록 · 기록 상세 · 환자 생성 · 기록 추가 · 이미지 업로드
- 응답 필드: 환자 `patientid, firstname, lastname, gender, birthdate, thumbnail, linkid, link` ·
  기록 `recorddate, recordhash, thumbnail` · 기록 상세 `url_ceph, url_ceph_big, url_pa, url_pa_big`
- 인증: Partner API Key(소프트웨어 식별, 파트너 발급) + 사용자별 API 암호(WebCeph 계정관리 "Set API Password")
- 한도: 사용자당 30 req/min · 병원은 WebCeph **Premium 이상**
- ⚠️ 공개 문서에 미포함(파트너 문서 필요): HTTP 메서드·정확한 경로·인증 전달 방식·에러 코드

## 3. 설계

| 레이어 | 내용 |
|---|---|
| 키 보관 | Partner Key = Vercel env(`WEBCEPH_PARTNER_KEY`). 기관별 사용자 API 암호 = 설정 → 연동(WebCeph) 입력, `institutions.consult_settings` jsonb(서버 전용 접근). 암호화 저장은 파트너 문서의 보안 요건 확인 후 결정(미결 #1) |
| 서버 프록시 | `lib/webceph/client.ts` + 서버 액션(`app/actions/webceph.ts`): 검색/기록목록/기록상세. 키·암호는 절대 클라이언트로 안 내려감. 30req/min 대비 짧은 캐시(환자별 기록목록 60s) |
| 환자 매칭 | Carelog patient(이름·생년월일) → WebCeph 환자 검색(이름) 후 생년월일 대조. 동명이인은 목록에서 사용자가 선택, 선택 결과는 patient에 webceph_patientid 저장(재조회 생략). 미연결 상담은 탭 숨김 |
| 픽커 UI | asset-picker '환자 사진' 탭(연동 설정 + 환자 연결 시 노출): 기록일자별 썸네일 그리드 → 원본 로드 |
| 기록에 담기 | ★외부 URL 직참조 금지(만료·권한) — 삽입 시점에 서버가 이미지를 받아 **consult 스토리지에 사본 저장** 후 그 URL 삽입(기존 업로드 정책·이그레스 압축 파이프 재사용) |
| 게이트 | env(`WEBCEPH_PARTNER_KEY`) 없으면 기능 전체 숨김 — 무해 배포 (크레딧 게이트웨이 패턴) |

## 4. 미결 (파트너 회신·자문 후)

1. 사용자 API 암호 저장 방식(평문 jsonb vs 암호화) — 파트너 보안 요건 확인.
2. **개인정보**: 환자 의료영상 제3자 제공/위탁 — 변호사 자문 백로그와 묶기(대표). 병원-환자 동의 문구, 어셈블서클과의 계약상 데이터 처리 조건.
3. 대상 병원: 교정 우선(이을치과 1호 후보 — WebCeph 사용 여부 확인).
4. 역방향(Carelog 스냅샷 → WebCeph 업로드)은 v2 검토.

## 5. 일정

파트너 키 + 기술문서 수령 후 **2~3일**: client·프록시(0.5) → 설정·매칭(1) → 픽커 탭·사본 저장(1) → 실측(0.5).
