-- spec 018 일일 서버(인프라) 리포트 — 스토리지·DB 용량 집계 함수.
--   storage.objects는 supabase_storage_admin 소유라 일반 조회가 제한 → SECURITY DEFINER(postgres 소유)로
--   버킷별 용량·객체수 + DB 크기를 집계해 반환. service_role(admin client)만 호출(슈퍼어드민 리포트).
--   ★이그레스(전송량) 자체는 DB에 없다(플랫폼 지표) → 스토리지 증가량을 조기경보 proxy로 사용.

create or replace function public.get_infra_usage()
returns jsonb language sql security definer set search_path = public, storage as $$
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', bucket_id, 'bytes', bytes, 'objects', cnt) order by bytes desc)
      from (
        select bucket_id,
               sum(coalesce((metadata->>'size')::bigint, 0)) as bytes,
               count(*) as cnt
        from storage.objects
        group by bucket_id
      ) s
    ), '[]'::jsonb)
  );
$$;
