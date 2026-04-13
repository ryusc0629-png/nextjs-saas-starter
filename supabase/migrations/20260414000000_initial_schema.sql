-- ============================================================
-- 퀄리오 (Qualio) DB 스키마 v1.0
-- 한국형 청소/홈케어 업체 B2B SaaS
-- ============================================================


-- ============================================================
-- 공통 유틸리티: updated_at 자동 갱신 트리거 함수
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ============================================================
-- 1. profiles (사용자 프로필)
-- Supabase auth.users 와 1:1 연결
-- ============================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  business_id uuid,                               -- 소속 사업체 (아래에서 FK 추가)
  role        text not null default 'owner'
               check (role in ('owner', 'staff')),
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();


-- ============================================================
-- 2. businesses (사업체)
-- 멀티테넌시 핵심 — 모든 데이터는 business_id 로 격리
-- ============================================================
create table businesses (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references profiles(id),
  name                text not null,              -- 업체명
  phone               text,                       -- 대표 전화
  address             text,                       -- 사업장 주소
  description         text,                       -- 업체 소개 (고객 견적 폼에 노출)
  logo_url            text,                       -- 로고 이미지 URL
  kakao_channel_id    text,                       -- 카카오 알림톡 채널 ID
  naver_place_url     text,                       -- 네이버 플레이스 리뷰 링크
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger businesses_updated_at
  before update on businesses
  for each row execute function update_updated_at();

-- profiles.business_id FK (businesses 테이블 생성 후 추가)
alter table profiles
  add constraint profiles_business_id_fkey
  foreign key (business_id) references businesses(id);


-- ============================================================
-- 3. subscriptions (구독 플랜)
-- 1차 베타: 무료. payment_id 는 nullable 로 미리 설계
-- ============================================================
create table subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id),
  plan                  text not null default 'beta'
                         check (plan in ('beta', 'starter', 'pro')),
  status                text not null default 'active'
                         check (status in ('active', 'past_due', 'cancelled')),
  payment_id            text,                     -- 토스페이먼츠 결제 ID (2차 베타에서 사용)
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();


-- ============================================================
-- 4. service_items (서비스 항목)
-- 예) 가정집 청소, 입주청소, 에어컨 청소
-- ============================================================
create table service_items (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id),
  name          text not null,                    -- 서비스명
  category      text,                             -- 카테고리 (예: 청소/소독/기타)
  base_price    integer not null default 0,       -- 기본가 (원 단위)
  unit          text not null default '회'
                 check (unit in ('회', '㎡', '시간', '개')),
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  deleted_at    timestamptz,                      -- soft delete (실수로 삭제해도 복구 가능)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger service_items_updated_at
  before update on service_items
  for each row execute function update_updated_at();


-- ============================================================
-- 5. quote_tiers (견적 3단계 설정)
-- Good / Better / Best 앵커링 전략
-- ============================================================
create table quote_tiers (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id),
  tier              text not null
                     check (tier in ('good', 'better', 'best')),
  label             text not null,                -- 표시명 (예: "기본", "추천", "프리미엄")
  description       text,                         -- 포함 서비스 설명
  price_multiplier  numeric(4,2) not null default 1.0, -- 기본가 대비 배율
  highlight         boolean not null default false,    -- "추천" 배지 표시 여부
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (business_id, tier)
);

create trigger quote_tiers_updated_at
  before update on quote_tiers
  for each row execute function update_updated_at();


-- ============================================================
-- 6. surcharge_rules (추가 요금 규칙)
-- 예) 20평 초과 시 +10,000원, 주말 +20%
-- ============================================================
create table surcharge_rules (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id),
  name            text not null,                  -- 규칙명 (예: "주말 할증")
  condition_type  text not null
                   check (condition_type in ('size_over', 'floor_above', 'special_type', 'weekend')),
  condition_value integer,                         -- 기준값 (예: 20 → 20평 초과)
  amount_type     text not null default 'fixed'
                   check (amount_type in ('fixed', 'percent')),
  amount          integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger surcharge_rules_updated_at
  before update on surcharge_rules
  for each row execute function update_updated_at();


-- ============================================================
-- 7. quotes (견적서)
-- 핵심 원칙: 개인정보 없음 — 서비스 정보만 받음
-- ============================================================
create table quotes (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id),
  -- 고객 입력값 (개인정보 없음)
  space_size      integer,                         -- 평수
  cleaning_type   text,                            -- 청소 종류
  preferred_date  date,                            -- 희망 날짜
  extra_notes     text,                            -- 기타 요청사항
  -- 계산된 가격 스냅샷 (단가 변경 후에도 기록 보존)
  good_price      integer,
  better_price    integer,
  best_price      integer,
  -- 상태 및 유효기간
  status          text not null default 'pending'
                   check (status in ('pending', 'booked', 'expired', 'cancelled')),
  expires_at      timestamptz not null default (now() + interval '3 days'),
  -- 마케팅 분석용
  utm_source      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger quotes_updated_at
  before update on quotes
  for each row execute function update_updated_at();


-- ============================================================
-- 8. bookings (예약)
-- 예약 확정 시에만 고객 개인정보 수집
-- ============================================================
create table bookings (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id),
  quote_id          uuid references quotes(id),   -- 견적에서 온 예약 (nullable: 직접 예약도 가능)
  -- 고객 정보 (예약 확정 시점에만 수집)
  customer_name     text not null,
  customer_phone    text not null,
  service_address   text not null,
  -- 예약 정보
  scheduled_at      timestamptz not null,
  duration_minutes  integer not null default 120, -- 예상 작업 시간(분)
  selected_tier     text not null default 'good'
                     check (selected_tier in ('good', 'better', 'best')),
  final_price       integer not null default 0,   -- 최종 확정 금액
  memo              text,                          -- 사장님 내부 메모
  -- 상태 관리
  status            text not null default 'confirmed'
                     check (status in ('confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  cancelled_at      timestamptz,
  cancel_reason     text,
  deleted_at        timestamptz,                   -- soft delete
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger bookings_updated_at
  before update on bookings
  for each row execute function update_updated_at();


-- ============================================================
-- 9. reports (완료 리포트)
-- 작업 완료 후 고객에게 카카오 알림톡으로 전송
-- ============================================================
create table reports (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null references businesses(id),
  booking_id              uuid not null references bookings(id),
  notes                   text,                    -- 작업 메모 / 특이사항
  review_request_sent_at  timestamptz,             -- 네이버 리뷰 요청 발송 시각
  kakao_sent_at           timestamptz,             -- 카카오 알림톡 발송 시각
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (booking_id)                              -- 예약 1건 = 리포트 1건
);

create trigger reports_updated_at
  before update on reports
  for each row execute function update_updated_at();


-- ============================================================
-- 10. report_photos (리포트 사진)
-- Before / After 사진 (Supabase Storage에 업로드 후 URL 저장)
-- ============================================================
create table report_photos (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references reports(id) on delete cascade,
  url         text not null,                       -- Supabase Storage URL
  type        text not null
               check (type in ('before', 'after')),
  caption     text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);


-- ============================================================
-- Row Level Security (RLS)
-- "A 업체는 절대로 B 업체 데이터를 볼 수 없다"
-- ============================================================
alter table profiles          enable row level security;
alter table businesses        enable row level security;
alter table subscriptions     enable row level security;
alter table service_items     enable row level security;
alter table quote_tiers       enable row level security;
alter table surcharge_rules   enable row level security;
alter table quotes            enable row level security;
alter table bookings          enable row level security;
alter table reports           enable row level security;
alter table report_photos     enable row level security;


-- 현재 로그인 사용자의 business_id 를 반환하는 헬퍼 함수
-- RLS 정책 전체에서 재사용 (성능 최적화: stable + security definer)
create or replace function get_my_business_id()
returns uuid as $$
  select business_id from profiles where id = auth.uid()
$$ language sql security definer stable;


-- RLS 정책: profiles (본인 것만)
create policy "본인 프로필만 접근"
  on profiles for all
  using (id = auth.uid());

-- RLS 정책: businesses
create policy "소속 사업체만 접근"
  on businesses for all
  using (id = get_my_business_id());

-- RLS 정책: subscriptions
create policy "소속 사업체 데이터만 접근"
  on subscriptions for all
  using (business_id = get_my_business_id());

-- RLS 정책: service_items
create policy "소속 사업체 데이터만 접근"
  on service_items for all
  using (business_id = get_my_business_id());

-- RLS 정책: quote_tiers
create policy "소속 사업체 데이터만 접근"
  on quote_tiers for all
  using (business_id = get_my_business_id());

-- RLS 정책: surcharge_rules
create policy "소속 사업체 데이터만 접근"
  on surcharge_rules for all
  using (business_id = get_my_business_id());

-- RLS 정책: quotes
create policy "소속 사업체 데이터만 접근"
  on quotes for all
  using (business_id = get_my_business_id());

-- RLS 정책: bookings
create policy "소속 사업체 데이터만 접근"
  on bookings for all
  using (business_id = get_my_business_id());

-- RLS 정책: reports
create policy "소속 사업체 데이터만 접근"
  on reports for all
  using (business_id = get_my_business_id());

-- RLS 정책: report_photos (reports 를 통해 간접 확인)
create policy "소속 사업체 리포트 사진만 접근"
  on report_photos for all
  using (
    report_id in (
      select id from reports where business_id = get_my_business_id()
    )
  );


-- ============================================================
-- 회원가입 시 자동으로 profiles 레코드 생성
-- 사용자가 가입하면 자동으로 프로필 테이블에 추가됨
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
