-- ============================================================
-- Limitation de débit sur la demande de défi WebAuthn.
--
-- POURQUOI : `login/start` est publique par nécessité (personne n'est connecté
-- quand on demande un défi). Sans garde-fou, n'importe qui peut la marteler et
-- faire grossir webauthn_challenges indéfiniment.
--
-- L'IP N'EST PAS STOCKÉE EN CLAIR : on garde un SHA-256 salé. Suffisant pour
-- compter des demandes sur une minute, inutilisable pour retrouver quelqu'un.
-- ============================================================

alter table public.webauthn_challenges
  add column if not exists client_ip_hash text;

-- Sert la fenêtre glissante « combien de demandes depuis cette empreinte ».
create index if not exists idx_webauthn_challenges_rate
  on public.webauthn_challenges (client_ip_hash, created_at desc)
  where client_ip_hash is not null;

comment on column public.webauthn_challenges.client_ip_hash is
  'SHA-256 salé de l''IP appelante. Sert uniquement à la limitation de débit ; jamais l''IP en clair.';
