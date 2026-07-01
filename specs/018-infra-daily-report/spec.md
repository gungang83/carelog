# Feature Specification: 일일 서버(인프라) 리포트

**Feature Branch**: `018-infra-daily-report` (작업: `claude/eo-sso-token-verify-w9v931`)
**Created**: 2026-06-29 · **Status**: Implemented
**Extends**: spec 014(일일 사용 리포트) · Trigger: 이그레스 초과 정지(경고 없음) → 인프라 가시성 필요

## Summary

매일 아침 일일 리포트에 **인프라(서버) 상태 섹션**을 더해, 슈퍼어드민이 **스토리지·DB 용량·신규 생성량·증가 추이**를 자동으로 본다. 이번 이그레스 정지처럼 **경고 없이 한도에 닿는 일**을 조기에 알아챈다.

- **집계**: `get_infra_usage()`(SECURITY DEFINER)로 버킷별 스토리지 용량·객체수 + DB 크기. 당일(KST) 신규 상담·이미지·음성 수는 `consultation` 조회.
- **조기경보**: 스토리지가 전일 대비 급증(+500MB↑)하면 리포트 "주의 신호"에 경고(= 이그레스 위험 proxy).
- **한계 명시**: 이그레스(전송량) 자체는 플랫폼 지표라 DB에 없음 → 정확값은 Supabase Usage 화면. 스토리지 증가량을 proxy로 사용.

## Requirements

- **FR-001** 일일 리포트(scope='all')에 인프라 섹션 포함: 총 스토리지(+전일 대비)·DB 크기·버킷별 용량/객체수·당일 신규 상담/이미지/음성.
- **FR-002** `get_infra_usage()` — storage.objects 집계(버킷별 bytes·count) + pg_database_size. service_role만 호출.
- **FR-003** 스토리지 전일 대비 +500MB 초과 시 경고 신호 추가.
- **FR-004** 인프라 집계 실패는 비차단(리포트 나머지는 정상 발행).
- **FR-005** 리포트에 "이그레스는 Supabase Usage에서 확인" 안내 명시.

## Success Criteria

- **SC-001** 슈퍼어드민이 매일 스토리지·DB 추이를 리포트 1개로 파악.
- **SC-002** 스토리지 급증 시 경고로 한도 초과 전 인지.

## Out of Scope

- **정확한 이그레스/쿼터 수치** — Supabase Management API 토큰 필요(후속: `SUPABASE_ACCESS_TOKEN` 붙이면 실이그레스·플랜 한도까지 표시 가능).
- 기관별 스토리지 분해(현재 버킷 단위 전체).
- 별도 인프라 대시보드(리포트 섹션으로 충분).
