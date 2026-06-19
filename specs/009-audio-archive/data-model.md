# Phase 1 Data Model: 음성 원본 보관

## 스키마 변경 (마이그레이션 `20260619000001_audio_archive.sql`)

### institutions (수정)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| plan | text not null default 'free' | `free` \| `standard` \| `pro` \| `enterprise`. CHECK 제약. 기능 게이트 단일 출처 |

### consultation (수정)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| audio_path | text null | 비공개 버킷 내 경로(`{institution_id}/{id}.webm`). 미보관/삭제 시 null |
| audio_uploaded_at | timestamptz null | 업로드 시각. 롤링·만료 계산 기준 |

> 텍스트(content)·기타 컬럼 불변. 음성 삭제는 audio_path/audio_uploaded_at만 null.

### audio_replay_logs (신규)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| institution_id | uuid not null → institutions | 기관 격리 |
| consultation_id | uuid not null → consultation | 대상 상담 |
| user_id | uuid not null | 재청취한 직원 |
| played_at | timestamptz not null default now() | 시각 |

- **chair_audit_logs와 분리**(realtime publication 오염 방지). RLS: 같은 기관 직원만 select/insert.
- 음성 본문·PII 미적재(메타만).

### Storage
- **신규 비공개 버킷 `consultation-audio`**(public=false). 정책: 인증 직원이 자기 기관 prefix(`{institution_id}/`)만 접근. 업로드/삭제/서명URL은 admin(service role) 경유가 기본.

## 영속 외 — 클라이언트 임시
- **보드 보유 audio blob**: 녹음 중지 후 저장 전까지 ref로 보존. 저장 성공 시 업로드, 그 후 해제.

## 정책 해석 (lib/plan.ts)
| plan | 보존 | 롤링상한 | 재청취 | 감사 |
|---|---|---|---|---|
| free | 롤링(기간 없음) | 3 | ✅(3개 한정) | ✗ |
| standard | 90일 | — | ✅ | ✗ |
| pro | 365일+(설정) | — | ✅ | ✅ |
| enterprise | 365일+/협의 | — | ✅ | ✅ |

## 상태 전이 (음성 1건)
`없음` → (저장 후 업로드) `보관(audio_path set)` → (free 4번째/만료 cron) `삭제(audio_path null)`.
텍스트 상담은 전 과정에서 불변.

## 검증 규칙 (요구 추적)
- 업로드·재청취·삭제·서명URL = Server Action only(FR-010, 헌법 II).
- 재청취 = 호출자 기관 == consultation 기관 + plan 만료 미초과(FR-003·004·006).
- 서명 URL 짧은 TTL, 공개 URL 금지(FR-002).
- 텍스트 보존(FR-005). 못 듣는 상태 안내(FR-013).
- pro 이상 재청취 1건 로그(FR-008).
