-- ★멀티워크스페이스 RLS 수정 (2026-06-29)
--   문제: get_my_institution_id()가 소속 기관 중 '첫 한 곳(limit 1)'만 반환 → 여러 기관 소속 사용자가
--         전환한 워크스페이스를 못 봄. getMyInstitutions도 1곳만 반환 → 전환 UI까지 사라짐(사용자 갇힘).
--   해결: RLS를 '멤버십 기반'으로 — 소속한 모든 기관을 접근 허용. 실제 표시 워크스페이스는 앱의
--         institution_id 필터가 정한다. 역할(admin/owner) 검사는 '해당 행의 기관' 기준으로 유지.
--   격리: 소속 기관에 한정(타 기관 유출 없음). service_role 전용 테이블(usage/credit/jobs)은 무관.

-- 소속 기관 id 집합 — SECURITY DEFINER(RLS 우회)로 institution_members 자기참조 재귀 방지.
create or replace function public.my_institution_ids()
returns setof uuid language sql security definer stable as $$
  select institution_id from public.institution_members where user_id = auth.uid();
$$;

-- ─── patient ─────────────────────────────────────────────────────────────────
drop policy if exists "staff sees own institution patients" on public.patient;
create policy "staff sees own institution patients" on public.patient
  for all
  using (institution_id in (select public.my_institution_ids()))
  with check (institution_id in (select public.my_institution_ids()));

-- ─── consultation ────────────────────────────────────────────────────────────
drop policy if exists "staff sees own institution consultations" on public.consultation;
create policy "staff sees own institution consultations" on public.consultation
  for all
  using (institution_id in (select public.my_institution_ids()))
  with check (institution_id in (select public.my_institution_ids()));

-- ─── institutions ────────────────────────────────────────────────────────────
drop policy if exists "member sees own institution" on public.institutions;
create policy "member sees own institution" on public.institutions
  for select using (id in (select public.my_institution_ids()));

-- ─── institution_members ─────────────────────────────────────────────────────
drop policy if exists "member sees own institution members" on public.institution_members;
create policy "member sees own institution members" on public.institution_members
  for select using (institution_id in (select public.my_institution_ids()));

-- ─── institution_invitations ─────────────────────────────────────────────────
drop policy if exists "admin manages invitations" on public.institution_invitations;
create policy "admin manages invitations" on public.institution_invitations
  for all using (institution_id in (select public.my_institution_ids()));

-- ─── activity_logs ───────────────────────────────────────────────────────────
drop policy if exists "institution members can read activity_logs" on public.activity_logs;
create policy "institution members can read activity_logs" on public.activity_logs
  for select using (institution_id in (select public.my_institution_ids()));

-- ─── chairs (읽기: 직원 / 쓰기: admin·owner) ────────────────────────────────
drop policy if exists "staff reads own institution chairs" on public.chairs;
create policy "staff reads own institution chairs" on public.chairs
  for select using (institution_id in (select public.my_institution_ids()));

drop policy if exists "admin manages chairs" on public.chairs;
create policy "admin manages chairs" on public.chairs
  for all
  using (
    institution_id in (select public.my_institution_ids())
    and exists (
      select 1 from public.institution_members m
      where m.user_id = auth.uid() and m.institution_id = chairs.institution_id
        and m.role in ('admin', 'owner')
    )
  )
  with check (
    institution_id in (select public.my_institution_ids())
    and exists (
      select 1 from public.institution_members m
      where m.user_id = auth.uid() and m.institution_id = chairs.institution_id
        and m.role in ('admin', 'owner')
    )
  );

-- ─── chair_audit_logs (읽기: 직원 / 삽입: 본인) ─────────────────────────────
drop policy if exists "staff reads own institution audit logs" on public.chair_audit_logs;
create policy "staff reads own institution audit logs" on public.chair_audit_logs
  for select using (institution_id in (select public.my_institution_ids()));

drop policy if exists "staff inserts audit logs" on public.chair_audit_logs;
create policy "staff inserts audit logs" on public.chair_audit_logs
  for insert with check (
    institution_id in (select public.my_institution_ids())
    and actor_user_id = auth.uid()
  );

-- ─── clinic_members (읽기: 직원 / 쓰기: admin·owner) ────────────────────────
drop policy if exists "staff reads own institution clinic_members" on public.clinic_members;
create policy "staff reads own institution clinic_members" on public.clinic_members
  for select using (institution_id in (select public.my_institution_ids()));

drop policy if exists "admin manages clinic_members" on public.clinic_members;
create policy "admin manages clinic_members" on public.clinic_members
  for all
  using (
    institution_id in (select public.my_institution_ids())
    and exists (
      select 1 from public.institution_members m
      where m.user_id = auth.uid() and m.institution_id = clinic_members.institution_id
        and m.role in ('admin', 'owner')
    )
  )
  with check (
    institution_id in (select public.my_institution_ids())
    and exists (
      select 1 from public.institution_members m
      where m.user_id = auth.uid() and m.institution_id = clinic_members.institution_id
        and m.role in ('admin', 'owner')
    )
  );

-- ─── audio_replay_logs (읽기/삽입) ──────────────────────────────────────────
drop policy if exists "audio_replay same institution read" on public.audio_replay_logs;
create policy "audio_replay same institution read" on public.audio_replay_logs
  for select using (institution_id in (select public.my_institution_ids()));

drop policy if exists "audio_replay same institution insert" on public.audio_replay_logs;
create policy "audio_replay same institution insert" on public.audio_replay_logs
  for insert with check (institution_id in (select public.my_institution_ids()));

-- ─── notifications (읽기: 직원) ─────────────────────────────────────────────
drop policy if exists "staff reads own institution notifications" on public.notifications;
create policy "staff reads own institution notifications" on public.notifications
  for select using (institution_id in (select public.my_institution_ids()));
