-- Normalize legacy fuzz seeds that were written as 32 ASCII hex characters into bytea.
-- This preserves the exact logical seed/offset while converting storage to the intended 16 bytes.
update public.locations
set fuzz_seed = decode(encode(fuzz_seed, 'escape'), 'hex')
where octet_length(fuzz_seed) = 32
  and encode(fuzz_seed, 'escape') ~ '^[0-9A-Fa-f]{32}$';
