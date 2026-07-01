# Feature Specification: 운영자별 일일 사용 리포트

**Feature Branch**: `019-operator-daily-report` (작업: `claude/eo-sso-token-verify-w9v931`)
**Created**: 2026-06-29 · **Status**: Implemented
**Extends**: spec 014(일일 리포트) — 생성기 scope 재사용

## Summary

지금까지 일일 리포트는 슈퍼어드민(전체 워크스페이스)만 받았다. 이제 **각 기관 관리자(owner/admin)**도
**자기 워크스페이스** 일일 사용 리포트를 받는다. 생성기 `buildDailyReport({scope: institutionId})`를
그대로 재사용하고, cron 발송과 열람 페이지만 추가.

- **발송**: cron이 당일 활동 있는 기관마다 리포트 발행 + 그 기관 관리자에게 **알림함**(recipients='admins', **푸시는 억제** — 전 직원 스팸 방지).
- **열람**: `/reports/daily/[date]` — 기관 관리자 전용, 자기 워크스페이스만. 설정 페이지에 진입 링크.
- **격리**: scope=institutionId라 집계가 자기 기관으로 자동 한정(다른 기관·인프라 지표 미노출).

## Requirements

- **FR-001** cron(daily-usage-report)이 전체 리포트 후 당일 활동 기관별 리포트를 발행·저장(usage_reports scope=institutionId).
- **FR-002** 기관마다 `sendNotification(recipients:'admins', push:false)` — 관리자 알림함에만(전 직원 푸시 안 함).
- **FR-003** `/reports/daily/[date]` — owner/admin만(staff·비관리자 redirect). 활성 기관 scope로 리포트 표시.
- **FR-004** 리포트 뷰는 슈퍼어드민 것과 공용(DailyReportView) — scopeLabel="우리 워크스페이스", 인프라 섹션 없음(scope≠all).
- **FR-005** 설정 페이지에 관리자용 "일일 리포트" 진입 링크(`/reports/daily/today`).

## Success Criteria

- **SC-001** 기관 관리자가 매일 아침 자기 워크스페이스 사용 현황을 알림 1건으로 받음.
- **SC-002** 관리자 아닌 직원에겐 노출·발송 안 됨.

## Out of Scope

- 운영자 리포트 웹푸시(관리자만 골라 푸시하려면 admin user 필터 필요 — 후속). 현재 인앱 알림함만.
- 기관별 발송 on/off 설정(현재 활동 있으면 자동).
- 이메일 채널.
