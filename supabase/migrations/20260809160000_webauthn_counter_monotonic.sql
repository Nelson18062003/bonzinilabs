-- ============================================================
-- Garde-fou : le compteur anti-clonage d'une clé d'accès ne recule jamais.
--
-- L'Edge Function `passkey` avance déjà le compteur sous verrou optimiste
-- (UPDATE … WHERE counter = <valeur lue>), ce qui règle la course entre deux
-- assertions simultanées. Ce déclencheur est la ceinture en plus des bretelles :
-- même en cas d'écriture directe (service role, script de maintenance, futur
-- code distrait), une valeur qui recule est refusée par la base.
--
-- ÉGALITÉ AUTORISÉE, ET C'EST NÉCESSAIRE : les authenticators iOS et Android
-- renvoient 0 en permanence. Interdire l'égalité rendrait toute connexion par
-- clé d'accès impossible sur téléphone.
-- ============================================================

create or replace function public.webauthn_counter_never_decreases()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.counter < old.counter then
    raise exception
      'Compteur de clé d''accès en recul (% → %) : clé possiblement clonée',
      old.counter, new.counter
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_webauthn_counter_monotonic on public.webauthn_credentials;

create trigger trg_webauthn_counter_monotonic
  before update of counter on public.webauthn_credentials
  for each row
  execute function public.webauthn_counter_never_decreases();

comment on function public.webauthn_counter_never_decreases() is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","label":"Garde-fou interne : compteur WebAuthn monotone"}';

notify pgrst, 'reload schema';
