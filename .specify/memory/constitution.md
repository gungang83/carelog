<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0 (MINOR: Principle VI added, Governance expanded)
Modified principles: none
Added sections: Principle VI (Documentation as Living Artifact)
Removed sections: none
Templates updated:
  ✅ .specify/memory/constitution.md (this file)
  ✅ .specify/templates/plan-template.md — Constitution Check updated to include I–VI
  ✅ CLAUDE.md — 마무리 프로토콜 및 문서 관리 원칙 추가
Deferred TODOs: none
-->

# Carelog Constitution

## Core Principles

### I. Patient Privacy First

Patient personal information is the most sensitive asset in this system.
All code that touches patient data MUST follow these non-negotiable rules:

- Resident registration numbers (주민등록번호) MUST be masked in all UI surfaces
  (display format: `880101-1******`). Full numbers MUST never appear in rendered HTML.
- Sensitive fields MUST NOT be written to any log, console output, or error message.
- Individual privacy consent (개인정보 활용 동의) MUST be recorded per patient before
  resident numbers or other sensitive identifiers are stored or used.
- Any new field classified as personal information MUST be reviewed for masking and
  consent requirements before shipping.

### II. Server-Side Data Authority

All data mutations and sensitive reads MUST originate from Next.js Server Actions.
Client components are display-only.

- No `fetch` or direct Supabase calls from client components for write operations.
- Server Actions MUST validate and sanitize all inputs before touching the database.
- Supabase Row Level Security (RLS) is the last-line enforcement layer; Server Actions
  are the primary enforcement layer. Both MUST be maintained.
- TypeScript types for database rows MUST be kept in `lib/types/database.ts` and used
  consistently — no `any` casts on data that crosses the server/client boundary.

### III. Clinical Reliability

A dental clinic depends on this data for patient care. Data loss or silent corruption
is clinically unacceptable.

- Every server action MUST return an explicit `{ ok: true, ... } | { ok: false, message }` 
  result. Errors MUST be surfaced to the clinician with a Korean-language message.
- Update operations MUST never silently drop fields. Patch objects MUST list every
  intended field explicitly — no spread-based merges that may omit fields.
- After any patient record mutation, `revalidatePath` MUST be called for all affected
  routes to prevent stale data being shown.
- Feature work that changes the patient data schema MUST include a Supabase migration
  and be tested against the real database before merging.

### IV. Simplicity Over Abstraction

This is a focused clinical tool. Complexity is a maintenance burden for a small team.

- Three similar lines of code are preferable to a premature abstraction.
- New utilities or helper modules MUST solve a concrete problem already present in at
  least two call sites. One-off helpers belong inline.
- No feature flags, backward-compatibility shims, or dead code. Remove rather than comment out.
- UI components MUST do one thing. Split when a component handles more than one logical concern.

### VI. Documentation as Living Artifact

Documentation is part of the deliverable, not an afterthought.
A feature is not complete until its documentation reflects the current state.

- `project_status.md` MUST be updated in every session: completed features, resolved issues,
  newly discovered issues, and next priorities.
- `docs/architecture.md` MUST be updated whenever a new file, directory, or data flow is added
  or removed.
- `docs/database.md` and `supabase/schema.sql` MUST be updated together for every schema change.
  A schema change committed without updating both files is a constitution violation.
- The **마무리 (wrap-up) protocol** MUST be followed whenever the user signals session end
  ("마무리하자", "마무리해줘", "wrap up", etc.):
  1. Update all affected documentation
  2. Run `npm run build` — fix any errors before proceeding
  3. Commit all changes with a descriptive message
  4. Push to GitHub (`git push origin main`)
  5. Confirm Vercel deployment is triggered
  No session ends without completing all five steps.

### V. Spec-Driven Development

All non-trivial features MUST be specified before implementation begins.

- Features that touch patient data, introduce new DB columns, or change existing API
  contracts MUST go through the full speckit workflow:
  `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`
- A spec file MUST exist at `specs/[###-feature-name]/spec.md` before any code is written.
- Implementation MUST NOT deviate from the approved spec without updating the spec first.
- Bug fixes and one-line patches are exempt from the full workflow but MUST still be
  described in the commit message with root cause and verification steps.

## Technology Constraints

**Runtime**: Next.js 16.2.2 App Router (React Server Components by default).
All new pages and layouts MUST use the App Router convention. Pages Router patterns
MUST NOT be introduced.

**Database**: Supabase (PostgreSQL). All schema changes require an explicit migration file
in the `supabase/` directory. Direct DDL executed in the Supabase dashboard without a
corresponding migration file is prohibited.

**Styling**: Tailwind CSS v4. Utility classes only — no `<style>` blocks or external CSS
files except `app/globals.css`. Custom design tokens go in `globals.css` via CSS variables.

**Deployment target**: Vercel. All code MUST be compatible with Vercel's Edge/Serverless
environment. Long-running or stateful server processes are not permitted.

**Language**: TypeScript strict mode. `any` types require an inline comment explaining why
no narrower type is possible. `@ts-ignore` is prohibited.

## Development Workflow

1. Confirm the feature is specified (`specs/[###]/spec.md` exists and is approved).
2. Create a feature branch named `[###-feature-slug]` from `main`.
3. Implement in small, buildable commits — each commit MUST leave the build green.
4. Vercel preview deployment is the acceptance environment. Test on the preview URL
   before requesting merge.
5. Merge to `main` only when: build passes, no TypeScript errors, feature tested on
   preview, and spec acceptance criteria are met.

## Governance

This constitution supersedes all other implicit conventions in this repository.
Any practice that conflicts with a principle above MUST be updated to comply.

**Amendment procedure**: Propose a change by running `/speckit-constitution` with the
proposed amendment as an argument. The amendment MUST be ratified by the project lead
before the updated constitution is committed. Version MUST be bumped per semantic rules:

- MAJOR: Removal or redefinition of an existing principle.
- MINOR: New principle or section added.
- PATCH: Clarification, wording fix, or non-semantic refinement.

**Compliance review**: Every implementation plan (`/speckit-plan` output) MUST include a
Constitution Check section that gates on Principles I–V before Phase 0 research begins.

**Runtime guidance**: See `CLAUDE.md` and `AGENTS.md` for AI agent session instructions.

**Version**: 1.1.0 | **Ratified**: 2026-05-08 | **Last Amended**: 2026-05-08
