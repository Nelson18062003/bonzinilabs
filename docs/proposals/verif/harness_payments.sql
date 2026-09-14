-- Stub Supabase minimal pour tester les politiques de public.payments
create extension if not exists pgcrypto;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create type public.payment_status as enum ('created','waiting_beneficiary_info','ready_for_payment','processing','completed','rejected','cash_pending','cash_scanned','cancelled_by_admin');
create type public.payment_method as enum ('alipay','wechat','bank_transfer','cash');
create type public.app_role as enum ('super_admin','ops','support','customer_success','cash_agent','treasurer');
create table public.user_roles (user_id uuid primary key, role public.app_role not null, is_disabled boolean default false);
create table public.payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, amount_xaf bigint not null, amount_rmb numeric not null,
  exchange_rate numeric, status public.payment_status not null default 'created', method public.payment_method not null default 'alipay',
  beneficiary_id uuid, beneficiary_details jsonb, beneficiary_name text, beneficiary_phone text, beneficiary_email text,
  beneficiary_bank_name text, beneficiary_bank_account text, beneficiary_bank_extra text, beneficiary_identifier text,
  beneficiary_identifier_type text, beneficiary_notes text, beneficiary_qr_code_url text, rate_is_custom boolean default false,
  cash_signature_url text, updated_at timestamptz default now());
create or replace function public.is_admin(uid uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from public.user_roles where user_id = uid and (is_disabled = false or is_disabled is null)) $$;
create or replace function public.is_cash_agent(uid uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from public.user_roles where user_id = uid and role = 'cash_agent' and (is_disabled = false or is_disabled is null)) $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;   -- défaut Supabase
grant execute on all functions in schema public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter table public.payments enable row level security;
-- Politiques telles qu'écrites dans le dépôt (20251220211736, 20260107115520, 20260331000001)
create policy "Users can view own payments" on public.payments for select using (auth.uid() = user_id);
create policy "Users can create own payments" on public.payments for insert with check (auth.uid() = user_id);
create policy "Users can update own payments beneficiary info" on public.payments for update
  using ((auth.uid() = user_id) and (status = any (array['created'::payment_status,'waiting_beneficiary_info'::payment_status,'ready_for_payment'::payment_status])))
  with check ((auth.uid() = user_id) and (status = any (array['created'::payment_status,'waiting_beneficiary_info'::payment_status,'ready_for_payment'::payment_status])));
create policy "Admins can view all payments" on public.payments for select using (is_admin(auth.uid()));
create policy "Admins can update payments" on public.payments for update using (is_admin(auth.uid()));
create policy "Cash agents can update cash payments" on public.payments for update
  using (is_cash_agent(auth.uid()) and method = 'cash'::payment_method and status in ('cash_pending'::payment_status,'cash_scanned'::payment_status));
-- Données : un client, un admin ops, un agent cash, un paiement du client créé « par la RPC »
insert into public.user_roles values ('00000000-0000-0000-0000-00000000000a','ops',false), ('00000000-0000-0000-0000-00000000000c','cash_agent',false);
insert into public.payments (id,user_id,amount_xaf,amount_rmb,status,method) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',100000,1150,'ready_for_payment','alipay'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',200000,2300,'cash_scanned','cash');
