-- spec 035 — 기공지 작성을 Carelog로 (EO spec-138 연동 · 카드 #1957/#1959)
--   Carelog = 쓰는 곳(양식 정의·작성·첨부), EO = 거래로 받는 곳(의뢰 레코드·/lab-work·정산).
--   양식은 코드가 아닌 데이터 정의(기공소마다 다름 — 대표 확정). 지플란트 실물이 첫 시드.

-- 양식 정의 — eval_templates(spec 034)·상담자료(spec 029)와 같은 "데이터 정의" 계열
create table if not exists public.lab_order_forms (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade, -- NULL = 전역 기본
  lab_name       text,          -- NULL = 모든 기공소 공통 / 지정 = 해당 기공소 전용(EO 거래처명과 매칭)
  name           text not null,
  version        integer not null default 1,
  -- def: { key, prosthesis_options:[], shade_systems:[], sections:[{id,title,fields:[{id,label,type,options?,unit?,hint?}]}] }
  --   field type: text|textarea|select|multi|check|number|date|ea(수량)
  def            jsonb not null default '{}',
  active         boolean not null default true,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 의뢰(기공지) 레코드 — id = carelog_order_id(멱등 키, 클라 생성 uuid). EO 전송 큐 겸용.
create table if not exists public.lab_orders (
  id              uuid primary key,
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  consultation_id bigint references public.consultation(id) on delete set null,
  patient_id      bigint references public.patient(id) on delete set null,
  lab_name        text not null,
  form_id         uuid references public.lab_order_forms(id) on delete set null,
  -- payload: 계약 §2-2 전송 스냅샷(attachments는 path 보관 — 서명 URL은 전송 시점 생성)
  payload         jsonb not null default '{}',
  status          text not null default 'queued',  -- queued(전송 대기·재시도) | sent | failed(영구)
  eo_order_id     text,
  portal_status   text,
  attempts        integer not null default 0,
  error           text,
  sent_at         timestamptz,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_lab_orders_inst on public.lab_orders (institution_id, created_at desc);
create index if not exists idx_lab_orders_queue on public.lab_orders (status, updated_at);

alter table public.lab_order_forms enable row level security;
alter table public.lab_orders      enable row level security;
-- 정책 0 — service_role(서버 액션·cron 워커)만. 접근 가드는 멤버십 기반 서버 액션.

-- 첨부 보관용 비공개 버킷(사진·동영상·그리기) — 서명 URL로만 접근(EO가 pull 복사)
insert into storage.buckets (id, name, public)
values ('lab-orders', 'lab-orders', false)
on conflict (id) do nothing;
