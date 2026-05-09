# Carelog Design System

**최종 업데이트**: 2026-05-09  
**상태**: 현행 앱 기준 (Sticky, Claude Design 등 AI 디자인 도구 연동용)

---

## 브랜드 정체성

**제품명**: Carelog  
**카테고리**: 의료 SaaS (치과 클리닉 상담 기록)  
**톤앤매너**: 신뢰감 있고 깔끔한 클리닉 도구. 병원스럽지 않게, 하지만 전문적으로.  
**키워드**: Clean · Trustworthy · Efficient · Medical-grade

---

## 컬러 팔레트

### Primary — Sky Blue (신뢰, 의료, 클리닉)

| 토큰 | Tailwind 클래스 | Hex | 용도 |
|---|---|---|---|
| Primary | `sky-600` | `#0284c7` | 주요 버튼, 링크, 강조 |
| Primary Hover | `sky-700` | `#0369a1` | 버튼 hover |
| Primary Light | `sky-50` | `#f0f9ff` | 배경, hover 상태 |
| Primary Border | `sky-200` | `#bae6fd` | 카드 테두리, 구분선 |
| Primary Muted | `sky-100` | `#e0f2fe` | 섹션 구분 배경 |

### Neutral — Slate (텍스트, 구조)

| 토큰 | Tailwind 클래스 | Hex | 용도 |
|---|---|---|---|
| Text Primary | `slate-900` | `#0f172a` | 본문 텍스트 |
| Text Secondary | `slate-800` | `#1e293b` | 섹션 제목 |
| Text Muted | `slate-600` | `#475569` | 보조 설명 |
| Text Subtle | `slate-500` | `#64748b` | 플레이스홀더, 힌트 |
| Text Faint | `slate-400` | `#94a3b8` | 빈 상태 텍스트 |

### Semantic

| 토큰 | Tailwind 클래스 | Hex | 용도 |
|---|---|---|---|
| Error | `red-600` | `#dc2626` | 에러 메시지 |
| Success | `green-600` | `#16a34a` | 성공 피드백 |
| Warning | `amber-500` | `#f59e0b` | 경고 |

### Background

| 토큰 | 값 | 용도 |
|---|---|---|
| App Background | `#f0f9ff` (sky-50) | 전체 페이지 배경 |
| Card Background | `#ffffff` | 카드, 패널 |
| Input Background | `sky-50/50` | 입력 필드 배경 |

---

## 타이포그래피

**폰트**: Geist Sans (기본), Geist Mono (코드)  
**Fallback**: `system-ui, sans-serif`

| 레벨 | 클래스 | 용도 |
|---|---|---|
| Page Title | `text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl` | 페이지 H1 |
| Section Title | `text-sm font-semibold text-slate-800` | 카드 내 섹션 헤더 |
| Label | `text-sm font-medium text-slate-600` | 폼 라벨 |
| Body | `text-sm text-slate-600` | 설명 텍스트 |
| Caption | `text-xs text-slate-500` | 힌트, 부제목 |
| Overline | `text-sm font-medium uppercase tracking-[0.12em] text-sky-600` | 카테고리 레이블 |
| Error Text | `text-sm text-red-600` | 에러 메시지 |

---

## 컴포넌트 패턴

### 카드 (Card)

```
rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/80
```

**변형**:
- 기본: `border-sky-100`
- 점선 (빈 상태): `border border-dashed border-sky-200 bg-white/80`

### 버튼

**Primary (주요 액션)**:
```
inline-flex min-h-11 items-center justify-center rounded-xl 
bg-sky-600 px-6 text-sm font-semibold text-white 
shadow-sm shadow-sky-200 transition hover:bg-sky-700 disabled:opacity-60
```

**Secondary (보조 액션)**:
```
inline-flex min-h-11 items-center justify-center rounded-xl 
border border-sky-200 bg-white px-6 text-sm font-semibold text-sky-800 
shadow-sm transition hover:bg-sky-50
```

**최소 높이**: `min-h-11` (44px) — 모바일 터치 타겟 기준

### 입력 필드 (Input)

```
min-h-11 flex-1 rounded-xl border border-sky-200 bg-sky-50/50 
px-4 text-slate-900 outline-none ring-sky-400/40 
placeholder:text-slate-400 focus:border-sky-400 focus:ring-2
```

### 목록 아이템 (List Item)

```
py-3 first:pt-0 last:pb-0 (li)
내부: flex min-h-[3rem] flex-col gap-3 rounded-xl px-2 py-3 
      transition hover:bg-sky-50 sm:flex-row sm:items-center
```

### 구분선

```
divide-y divide-sky-100
```

---

## 레이아웃

### 페이지 컨테이너

```
mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6
```

### 콘텐츠 컨테이너 (카드 내)

```
mx-auto flex w-full max-w-2xl flex-col gap-8
```

### 반응형 원칙

- 모바일 우선 (flex-col 기본)
- `sm:` breakpoint에서 가로 레이아웃 전환
- 최대 너비: `max-w-3xl` (페이지), `max-w-2xl` (콘텐츠)

---

## 간격 (Spacing)

| 용도 | 값 |
|---|---|
| 페이지 상단 패딩 | `py-12` |
| 섹션 간격 | `gap-10` |
| 카드 내 패딩 | `p-6` |
| 카드 내 요소 간격 | `gap-8` |
| 라벨 → 입력 | `mt-3` |
| 제목 → 설명 | `mt-1` |
| 목록 아이템 | `py-3` |

---

## 아이콘 & 이미지

- 현재 전용 아이콘 라이브러리 미사용
- 필요 시 `lucide-react` 추가 권장 (Tailwind와 친화적, tree-shakable)
- 로고: 텍스트 기반 ("C" 이니셜 + "Carelog" wordmark)

---

## 빈 상태 (Empty State) 패턴

```
rounded-2xl border border-dashed border-sky-200 bg-white/80 p-6 shadow-sm
```
- 제목: `text-sm font-semibold text-slate-800`
- 설명: `text-sm text-slate-600`
- 액션: Secondary 버튼

---

## 페이지별 헤더 구조

```html
<header class="text-center sm:text-left">
  <p class="text-sm font-medium uppercase tracking-[0.12em] text-sky-600">
    Dental chart          ← 카테고리 레이블
  </p>
  <h1 class="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
    Carelog               ← 페이지 타이틀
  </h1>
  <p class="mt-2 max-w-xl text-slate-600">
    설명 텍스트           ← 서브타이틀
  </p>
</header>
```

---

## 신규 화면 디자인 가이드 (Phase 1 Auth)

### 로그인 / 회원가입 페이지

- 중앙 정렬, `max-w-md` 단일 카드
- 상단: Carelog 로고 + 기관명
- 카드: 기본 Card 패턴 적용
- 버튼: Primary 버튼 전체 너비 (`w-full`)

### 대시보드 헤더 (기관명 표시)

- 상단 고정 bar: `bg-white border-b border-sky-100`
- 좌측: Carelog 로고 + 기관명 (`text-sm font-semibold text-slate-800`)
- 우측: 로그아웃 버튼 (Secondary, small)

### 설정 페이지 (직원 초대)

- 기본 Card 컨테이너
- 직원 목록: 기존 목록 아이템 패턴 재사용
- 역할 뱃지: `rounded-full px-2 py-0.5 text-xs font-medium`
  - owner: `bg-sky-100 text-sky-800`
  - admin: `bg-slate-100 text-slate-700`
  - staff: `bg-white border border-slate-200 text-slate-600`

---

## AI 디자인 도구 연동 메모

### Sticky 활용 시

이 문서의 컬러 팔레트, 컴포넌트 패턴, 간격 시스템을 Design Token으로 입력.
Primary: `#0284c7`, Background: `#f0f9ff`, Font: Geist Sans

### Claude Design / v0 활용 시

프롬프트에 아래 컨텍스트 포함:
```
Carelog는 치과 클리닉 상담 기록 SaaS입니다.
디자인 시스템: Tailwind CSS v4, sky-600 primary, slate 텍스트, rounded-2xl 카드.
기존 컴포넌트 패턴은 docs/design.md 참고.
새 화면은 기존 패턴을 최대한 재사용하고, 새 컴포넌트 최소화.
```
