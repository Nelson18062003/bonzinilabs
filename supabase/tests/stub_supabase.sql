-- ============================================================================
-- Un Supabase minimal, pour rejouer une migration et ses règles de sécurité
-- sur un PostgreSQL local (supabase/tests/run.sh). Ce n'est PAS le schéma de
-- production : seulement ce dont les migrations Douane ont besoin — les rôles
-- anon/authenticated/service_role, auth.uid() lu dans le JWT, le stockage,
-- et les tables publiques qu'elles touchent (user_roles, clients,
-- notifications, send_staff_push).
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

-- Comme Supabase : tout est accordé, la RLS fait le tri.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY, name TEXT, public BOOLEAN, file_size_limit BIGINT, allowed_mime_types TEXT[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT REFERENCES storage.buckets(id), name TEXT, owner UUID
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
GRANT EXECUTE ON FUNCTION storage.foldername(TEXT) TO anon, authenticated, service_role;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin','ops','support','customer_success','cash_agent','treasurer','receptionist','warehouse_agent');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id), role public.app_role NOT NULL,
  is_disabled BOOLEAN DEFAULT false, email TEXT, first_name TEXT, last_name TEXT
);
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, company_name TEXT, customer_code TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, type TEXT, title TEXT, message TEXT,
  metadata JSONB, created_at TIMESTAMPTZ DEFAULT now()
);
-- L'envoi réel passe par pg_net ; ici on note l'appel.
CREATE TABLE IF NOT EXISTS public._staff_push_log (permission TEXT, title TEXT, body TEXT, path TEXT, at TIMESTAMPTZ DEFAULT now());
CREATE OR REPLACE FUNCTION public.send_staff_push(p_permission TEXT, p_title TEXT, p_body TEXT, p_path TEXT, p_roles TEXT[] DEFAULT NULL, p_exclude UUID DEFAULT NULL)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public._staff_push_log (permission, title, body, path) VALUES (p_permission, p_title, p_body, p_path)
$$;
