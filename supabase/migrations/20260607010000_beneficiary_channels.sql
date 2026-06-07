-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Bénéficiaires Alipay/WeChat — élargir les canaux de contact acceptés        ║
-- ║ NOUVEAU fichier (la migration 20260607000000 est déjà mergée/appliquée ;    ║
-- ║ l'éditer ne la rejouerait pas via db push → on met ce changement à part).   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Règle métier : un bénéficiaire Alipay/WeChat est valide avec le nom + AU MOINS UN
-- canal de contact parmi { identifiant, QR code, email, téléphone }.
-- Avant : la contrainte n'acceptait que { identifiant OU QR code }. On l'élargit.
-- Miroir de src/lib/beneficiaries/spec.ts (source de vérité partagée client + admin).
--
-- Une CHECK ne s'altère pas en place → drop puis re-add. NOT VALID : on ne re-scanne
-- pas les lignes existantes (et de toute façon cette règle est PLUS permissive qu'avant,
-- donc aucune ligne valide auparavant ne devient invalide). Idempotent.

alter table public.beneficiaries drop constraint if exists chk_benef_alipay_wechat_channel;
alter table public.beneficiaries
  add constraint chk_benef_alipay_wechat_channel check (
    payment_method not in ('alipay', 'wechat')
    or identifier is not null
    or qr_code_url is not null
    or email is not null
    or phone is not null
  ) not valid;

notify pgrst, 'reload schema';
