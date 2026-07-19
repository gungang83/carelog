-- spec 026 — 상담 자료에 '영상 링크' 종류 추가 (외부 콘텐츠 링크, 파일 업로드 아님).
--   영상의 기본 활용 = 환자 전달(포털/SMS) — 체어타임 보호. 스테이지 재생은 보조.

alter table public.consult_assets
  add column if not exists kind     text not null default 'image',  -- image | video_link
  add column if not exists link_url text;                           -- video_link일 때 외부 URL

alter table public.consult_assets
  drop constraint if exists consult_assets_kind_check;
alter table public.consult_assets
  add constraint consult_assets_kind_check check (kind in ('image', 'video_link'));

-- 영상 링크 자산은 이미지가 없을 수 있음
alter table public.consult_assets
  alter column image_url drop not null;
