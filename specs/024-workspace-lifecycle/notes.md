# spec 024 (기획 검토) — 워크스페이스 수정·삭제 (lifecycle)

> 상태: **기획 정리 단계 — 구현 착수 전.** 대표님 요청(세션 65): "중복 워크스페이스 하나를 삭제하려는데,
> 내 자격·EO 경유 여부 등 상황에 따라 달라질 것 같다. 개발 전에 고려사항부터 파악하자."
> 작성: 다온 · 2026-07-05 · 코드 근거는 각 절에 명시. 선행 SSOT: `docs/account-workspace-linking.md` §4.

---

## 1. 현재 사실관계 (코드 근거)

### 1.1 워크스페이스(기관)가 생기는 경로 3가지
| 경로 | 코드 | 만들어지는 것 |
|---|---|---|
| 셀프 가입(이메일/Google) | `app/actions/auth.ts` signUp / 온보딩 | 새 institutions + 본인 **owner** 멤버십 |
| **EO SSO** ("케어로그 열기") | `app/api/auth/sso/route.ts` 1-b | JWT의 `institution_id`(EO 자체발급 uuid)로 institutions **upsert** + 멤버십(**admin/staff만** — owner 없음) |
| 슈퍼어드민 선발급 | `createInstitutionAsAdmin` (/admin) | EO 링크용 기관(멤버 0명) — 같은 이름 있으면 재사용 |

### 1.2 현재 있는 수정·삭제 기능
- 기관명 수정: **owner만** (`updateInstitutionName`).
- 실험실 토글: 슈퍼어드민 (`setInstitutionLab`).
- **기관 삭제: 어디에도 없음.** owner도, 슈퍼어드민도 UI/액션 없음 → 현행 규칙상 DB 수동(`account-workspace-linking.md` §4.1).
- 직원 관리(활성/역할/제거): owner·admin + 슈퍼어드민 별도. 마지막 활성 owner 비활성화 차단 가드 있음.

### 1.3 데이터 귀속 — 삭제 시 물리적 결과 (FK 전수 확인)
- **cascade(기관 삭제 시 연쇄 삭제)**: institution_members·invitations, chairs, clinic_members, chair_audit_logs, activity_logs, notifications(+reads), 크레딧(잔액·원장·메뉴사용), transcription_jobs, review_flags, audio 아카이브 로그, patient portal 링크류, push_subscriptions.
- **★cascade 없음(= 삭제 거절 안전망)**: `patient.institution_id`, `consultation.institution_id` — **환자·상담 기록이 1건이라도 있으면 기관 hard DELETE는 DB가 FK로 거절한다.**
- 즉 "빈 기관"은 DELETE 한 방에 정리되지만, "데이터 있는 기관"은 이관(§4.3) 또는 명시적 파기 결정 없이는 지울 수 없다. **이 안전망은 유지 가치가 있음.**

### 1.4 EO 연동이 얽히는 지점 ★핵심 리스크
- EO 소유 `workspace_integrations(provider='carelog')`가 EO 클리닉 ↔ **특정 institution_id**를 가리킴(연동 SSOT는 EO 쪽).
- **좀비 부활 문제**: EO가 링크한 기관을 Carelog에서 지워도, 직원이 "케어로그 열기"를 누르는 순간 SSO 라우트 1-b가 **같은 id로 기관을 재생성**한다(이름은 토큰 institution_name). → EO 링크를 끊지 않는 한 삭제해도 되살아난다.
- 반대로 EO 링크 기관을 지우고 방치하면: 마스터 폴링(`/api/cron/sync-master`)·게이트웨이 호출이 유령 id를 계속 조회.
- → **원칙 후보: "EO 링크된 기관은 Carelog 단독으로 삭제 불가 — EO측 링크 해제(또는 재지정)가 선행되어야 한다."**

### 1.5 삭제 후 사용자 상태
- 멤버십이 cascade로 사라지면 `my_institution_ids()`에서 빠짐 → RLS로 데이터 접근 차단은 자동.
- **active institution 쿠키**(`ACTIVE_INSTITUTION_COOKIE`)가 삭제된 기관을 가리키는 stale 상태 처리 확인 필요(전환 UI/미들웨어 폴백).
- 사용자의 **마지막 기관**을 지우면 무기관 상태 → 온보딩으로 떨어지는지 검증 필요.

---

## 2. 자격(누가) × 대상(어떤 기관) 매트릭스 — 기획 논점

| 행위자 | 셀프가입 기관(비연동) | EO 링크 기관 |
|---|---|---|
| **슈퍼어드민(대표)** | 삭제/보관 허용 (관리 콘솔) | EO 링크 해제 선행 조건부 허용 |
| **owner** | (논점 A) 빈 기관 한정 셀프 삭제 허용? | 해당 없음 — EO 기관엔 owner가 없음(1.1) |
| **admin** (EO clinic_admin 매핑 포함) | 불가 권장 | 불가 권장 |
| **staff** | 불가 | 불가 |

- ★구조적 사실: EO SSO 기관은 SSO가 admin/staff만 부여하므로 **owner가 존재하지 않을 수 있다** → "owner만 삭제"로 설계하면 EO 기관은 영원히 못 지움. **EO 기관의 삭제 주체는 슈퍼어드민일 수밖에 없음.**
- 기관명 수정도 같은 문제: owner 전용(`updateInstitutionName`)이라 EO 기관은 이름을 아무도 못 바꿈 → 슈퍼어드민 이름변경을 /admin에 추가하는 것 검토(현재는 SSO 토큰 이름으로 자동 보정될 뿐).

## 3. 설계 논점과 다온 추천

| # | 논점 | 옵션 | 추천 |
|---|---|---|---|
| A | 삭제 권한 | ① 슈퍼어드민 전용 ② owner 셀프 삭제(빈 기관 한정) 병행 | **①로 시작** — 현재 실사용자는 예미안 파일럿뿐, 셀프 삭제 오조작 리스크 > 편익. §7.2 정리 도구는 후속. |
| B | 삭제 방식 | ① hard delete ② soft(archived_at, 목록·전환·SSO에서 숨김) ③ soft→유예 후 hard | **② soft 기본 + "빈 기관"만 즉시 hard 허용.** 환자·상담 FK 안전망(1.3)은 그대로 두고 우회하지 않는다. |
| C | EO 링크 기관 | ① Carelog 단독 삭제 허용 ② EO 링크 해제 선행 강제 | **②** — 좀비 부활(1.4) 때문에 ①은 실질 무의미. UI에서 "EO 연동 기관" 뱃지 + 삭제 차단 안내. |
| D | 데이터 있는 기관 | 이관(§4.3) 후 삭제 vs 파기 동의 후 삭제 | 이관은 별도 스펙(환자 중복·RRN 충돌·귀속 재계산). **v1 범위 제외** — "비우기 전엔 못 지움"이 안전. |
| E | 가드 | — | 마지막 기관 삭제 시 사용자 무기관 처리, active 쿠키 정리, 삭제 전 요약(멤버 n·환자 n·상담 n) 확인 다이얼로그, activity_logs 감사 기록. |

## 4. 대표님 당면 케이스(중복 2개 중 1개 삭제) — 코드 배포 없이 처리 가능

1. **진단** (Supabase SQL Editor):
```sql
select i.id, i.name, i.created_at,
  (select count(*) from institution_members m where m.institution_id = i.id) as members,
  (select count(*) from patient p where p.institution_id = i.id)            as patients,
  (select count(*) from consultation c where c.institution_id = i.id)       as consultations
from institutions i order by i.created_at;
```
2. **판정**: 지우려는 쪽이 ⓐ patients=0·consultations=0이고 ⓑ EO가 링크한 id가 아니면(EO `/superadmin/integrations` 또는 workspace_integrations에서 확인) → 안전.
3. **삭제**: `delete from institutions where id = '<대상>';` — 나머지는 cascade. 환자/상담이 있으면 FK가 거절하니 그때 멈추고 이관 논의.
4. EO 링크 기관을 남기고 중복(비연동) 쪽을 지우는 게 정석(§4.1). 반대로 하고 싶으면 EO측 링크 재지정(§4.2) 선행.

## 5. 다음 단계 (대표님 결정 후)

- [ ] 논점 A~D 대표님 확정 → 본 노트를 spec.md로 승격, FR 정리
- [ ] v1 구현 범위(안): 슈퍼어드민 /admin 기관 카드에 "보관(soft)"·"삭제(빈 기관만)" + EO 연동 뱃지 + 삭제 전 요약 다이얼로그 + 감사 로그, 슈퍼어드민 기관명 수정
- [ ] active 쿠키 stale·무기관 폴백 검증
- [ ] (별도 스펙) 기관 간 데이터 이관 도구, owner 셀프 정리(§7.2)
