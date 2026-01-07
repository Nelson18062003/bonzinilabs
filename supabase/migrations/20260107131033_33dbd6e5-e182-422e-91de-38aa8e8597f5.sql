-- Create storage bucket for cash signatures (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cash-signatures',
  'cash-signatures',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;