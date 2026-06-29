# Feature Specification: 사용량 대시보드 필터 고도화

**Feature Branch**: `015-usage-filters` (작업: `claude/eo-sso-token-verify-w9v931`)
**Created**: 2026-06-29 · **Status**: Implemented
**Extends**: spec 013(사용량·크레딧 대시보드) · spec 014(일일 리포트)

## Summary

사용량/크레딧 대시보드와 일일 리포트의 조회 필터를 고도화한다.

1. **기간 커스텀**: 프리셋(7/30/90/365일)에 더해 **직접 지정**(특정 일·특정 기간) 가능.
2. **사용자별 필터**: 기관뿐 아니라 **Carelog 사용자(이메일)**별로도 조회. 기관·사용자 모두 **검색형 드롭다운**(목록이 커져도 입력으로 필터링).
3. **리포트 날짜 검색**: 전일/익일에 더해 **날짜 직접 선택**으로 임의 일자 리포트 열람.

## Requirements

- **FR-001** summary API(menu·credit)가 `from`/`to`(YYYY-MM-DD, KST) 커스텀 기간을 수용. 미지정 시 `days` 프리셋. `from`만 주면 단일 일자.
- **FR-002** summary API가 `user`(이메일) 필터 수용 — credit=`created_by`, menu=`user_email` eq.
- **FR-003** 필터 옵션 엔드포인트 `/api/usage/filters` — 전체 기관 + 사용량 데이터 기준 사용자(이메일·소속기관) 목록. 슈퍼어드민 전용.
- **FR-004** 대시보드 기관·사용자 선택은 검색형 드롭다운(SearchSelect) — 입력으로 즉시 필터링.
- **FR-005** 리포트 페이지에 날짜 입력(date) 추가 — 선택 시 `/admin/usage/report/{date}`로 이동.
- **FR-006** 기간 경계는 KST 0~24시(credit=timestamptz UTC 경계, menu=day KST 일자). 시작>종료 입력은 스왑.
- **FR-007** 모든 조회는 슈퍼어드민 전용 유지(서버 권위).

## Success Criteria

- **SC-001** 특정 일/기간을 직접 지정해 그 구간만 조회 가능.
- **SC-002** 특정 사용자 1명의 사용량을 기관 무관하게 조회 가능.
- **SC-003** 기관·사용자가 많아도 검색으로 빠르게 선택.

## Out of Scope

- 서버사이드 사용자 검색/페이지네이션(현재 클라 필터로 충분 — 대량 시 후속).
- 리포트 자체의 사용자/기간 스코프(리포트는 일자 단위 전체 — 대시보드가 세부 조회 담당).
