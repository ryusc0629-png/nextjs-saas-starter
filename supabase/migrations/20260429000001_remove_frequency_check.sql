-- contracts.frequency 필드의 CHECK 제약 조건 제거
-- 방문 주기를 자유 텍스트로 직접 입력할 수 있도록 변경
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_frequency_check;
