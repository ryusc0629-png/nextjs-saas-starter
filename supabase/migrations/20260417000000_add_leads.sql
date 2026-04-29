-- 영업 CRM: 잠재고객(리드) 파이프라인 테이블
create table if not exists public.leads (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  company_name        text not null,                          -- 업체명
  contact_name        text,                                   -- 담당자명
  phone               text,                                   -- 연락처
  address             text,                                   -- 주소
  category            text,                                   -- 업종 (카페/병원/학원/오피스/상가/기타)
  status              text not null default 'new'             -- new/contacted/follow_up/quoted/contracted/rejected
    check (status in ('new','contacted','follow_up','quoted','contracted','rejected')),
  next_follow_up_date date,                                   -- 다음 방문/연락 예정일
  notes               text,                                   -- 메모
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- RLS 활성화
alter table public.leads enable row level security;

-- SELECT: 본인 업체의 리드만 조회
create policy "leads_select" on public.leads
  for select using (business_id = public.get_my_business_id());

-- INSERT: 본인 업체에만 추가
create policy "leads_insert" on public.leads
  for insert with check (business_id = public.get_my_business_id());

-- UPDATE: 본인 업체의 리드만 수정
create policy "leads_update" on public.leads
  for update using (business_id = public.get_my_business_id());

-- DELETE: 본인 업체의 리드만 삭제
create policy "leads_delete" on public.leads
  for delete using (business_id = public.get_my_business_id());

-- 인덱스
create index leads_business_id_idx on public.leads (business_id);
create index leads_status_idx on public.leads (business_id, status);
create index leads_follow_up_idx on public.leads (business_id, next_follow_up_date);
