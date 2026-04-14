-- ============================================================
-- quotes 테이블에 고객 연락처 컬럼 추가
-- 공개 견적 폼에서 고객명과 전화번호를 수집하기 위함
-- ============================================================

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_phone text;
