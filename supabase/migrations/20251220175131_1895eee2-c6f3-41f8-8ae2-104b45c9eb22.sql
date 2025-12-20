-- Add new fields to profiles table for extended user information
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS activity_sector text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS country text;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.date_of_birth IS 'User date of birth (optional)';
COMMENT ON COLUMN public.profiles.company_name IS 'User company name (optional)';
COMMENT ON COLUMN public.profiles.activity_sector IS 'User activity sector (optional)';
COMMENT ON COLUMN public.profiles.neighborhood IS 'User neighborhood/quartier (optional)';
COMMENT ON COLUMN public.profiles.city IS 'User city (optional)';
COMMENT ON COLUMN public.profiles.country IS 'User country (optional)';