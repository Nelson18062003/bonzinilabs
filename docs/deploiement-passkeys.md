# Déploiement — clés d'accès (passkeys) admin

Tout est écrit et vérifié en local (type-check, build, lint, 18 tests unitaires).
Il reste quatre gestes côté infrastructure, dans cet ordre.

## 1. Migration

```bash
npx supabase db push --linked
```

Crée `webauthn_credentials`, `webauthn_challenges`, la RPC `admin_revoke_passkey`
et `purge_webauthn_challenges`.

Puis régénérer les types — ils ont été complétés **à la main** dans cette branche
(pas d'accès au projet depuis l'environnement de développement), donc la
régénération est la source de vérité :

```bash
npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts
```

## 2. Secrets de l'Edge Function

| Secret | Valeur |
|---|---|
| `WEBAUTHN_RP_ID` | `bonzinilabs.com` |
| `WEBAUTHN_ORIGINS` | `https://www.bonzinilabs.com,http://localhost:8080` |

```bash
npx supabase secrets set WEBAUTHN_RP_ID=bonzinilabs.com
npx supabase secrets set WEBAUTHN_ORIGINS=https://www.bonzinilabs.com,http://localhost:8080
```

> `WEBAUTHN_RP_ID` doit être un **suffixe enregistrable** de l'origine. Pour
> `https://www.bonzinilabs.com`, `bonzinilabs.com` convient et couvre les
> sous-domaines. En local, la fonction bascule seule sur `localhost`.
>
> Une origine absente de `WEBAUTHN_ORIGINS` est refusée avant tout traitement.

## 3. Déployer la fonction

```bash
npx supabase functions deploy passkey
```

`verify_jwt = false` est déjà dans `supabase/config.toml` — indispensable, car
`login/start` et `login/finish` doivent répondre **avant** toute session. Le JWT
des routes `register/*` est vérifié à la main dans la fonction (`callerFromJwt`).
Ne pas retirer ce contrôle.

## 4. Test sur un vrai téléphone

Aucune manipulation possible depuis un environnement de développement : il faut
un appareil avec Face ID, Touch ID, empreinte ou déverrouillage facial.

1. Se connecter normalement (code email ou Google).
2. `Plus → Paramètres → Sécurité → Connexion rapide → Ajouter cet appareil`.
3. Se déconnecter.
4. L'écran de connexion doit maintenant proposer **« Se connecter avec cet
   appareil »** en action principale.

### Le point à surveiller au premier essai

`login/finish` ouvre la session via `admin.auth.admin.generateLink()`, qui
**génère** un jeton sans l'envoyer. Si un email « lien de connexion » arrivait
malgré tout à chaque usage de Face ID, c'est ce point qu'il faut revoir — le
comportement dépend de la configuration SMTP du projet et n'a pas pu être
vérifié depuis l'environnement de développement.

## Ce qui n'est pas fait

- **Limitation de débit sur `login/start`.** La route est publique et crée une
  ligne de défi à chaque appel. `purge_webauthn_challenges()` nettoie au fil de
  l'eau, mais rien n'empêche aujourd'hui quelqu'un de générer des défis en
  boucle. À ajouter si l'app devient publiquement visible.
- **Proposition d'enrôlement après connexion.** L'activation se fait
  aujourd'hui depuis Paramètres. Une carte proposée juste après une connexion
  réussie serait plus efficace pour un utilisateur qui ne fouille pas les
  réglages.

## Rappel — ce qui est stocké

Uniquement la clé **publique**. La clé privée ne quitte jamais la puce du
téléphone, et la biométrie ne nous est jamais transmise : Face ID, empreinte ou
code de déverrouillage servent seulement à débloquer la clé sur l'appareil. Une
fuite de `webauthn_credentials` ne permet à personne de se connecter.
