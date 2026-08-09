// ============================================================
// Edge Function: passkey — clés d'accès (WebAuthn) pour l'app ADMIN
//
// Quatre routes :
//   POST ?action=register/start    (JWT admin requis)  → défi d'enrôlement
//   POST ?action=register/finish   (JWT admin requis)  → vérifie + enregistre
//   POST ?action=login/start       (public)            → défi de connexion
//   POST ?action=login/finish      (public)            → vérifie + ouvre la session
//
// verify_jwt = false dans config.toml : les deux routes de connexion doivent
// être joignables SANS session (c'est tout l'intérêt). Le JWT des routes
// d'enrôlement est donc vérifié À LA MAIN ci-dessous — ne jamais retirer ce
// contrôle.
//
// CE QUI PROTÈGE LA ROUTE LA PLUS SENSIBLE (login/finish, qui délivre une
// session) :
//   1. le défi est aléatoire, à usage unique, périmable (table challenges) ;
//   2. la signature est vérifiée contre la clé PUBLIQUE enregistrée ;
//   3. l'origine et le RP ID sont vérifiés (anti-hameçonnage natif WebAuthn) ;
//   4. user verification exigée (Face ID / empreinte / code — pas juste la
//      présence d'un doigt sur une clé USB) ;
//   5. le compteur anti-clonage doit progresser ;
//   6. le compte doit TOUJOURS avoir un rôle admin actif — une clé valide sur
//      un compte désactivé n'ouvre rien.
// Aucune de ces étapes n'est optionnelle.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "https://esm.sh/@simplewebauthn/server@13.3.2";
import {
  b64uEncode,
  b64uDecode,
  rpIdFor as rpIdForOrigin,
  deviceLabelFrom,
  isCounterAcceptable,
  isAllowedOrigin,
} from "./helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RP_NAME = "Bonzini Admin";
// Domaine de la clé. DOIT être un suffixe enregistrable de l'origine :
// pour https://www.bonzinilabs.com, « bonzinilabs.com » couvre aussi les
// sous-domaines. En local, l'origine est http://localhost:8080 → « localhost ».
const RP_ID = Deno.env.get("WEBAUTHN_RP_ID") ?? "bonzinilabs.com";
const ALLOWED_ORIGINS = (Deno.env.get("WEBAUTHN_ORIGINS") ?? "https://www.bonzinilabs.com")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 min : le temps de regarder son téléphone.

// Limitation de débit sur la demande de défi (route publique).
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_PER_WINDOW = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(error: string, status = 400) {
  return json({ success: false, error }, status);
}

/** Origine réellement utilisée par l'appelant, si elle est autorisée. */
function resolveOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  return isAllowedOrigin(origin, ALLOWED_ORIGINS) ? origin : null;
}

const rpIdFor = (origin: string) => rpIdForOrigin(origin, RP_ID);

/**
 * Empreinte salée de l'IP appelante. L'IP en clair n'est jamais écrite : un
 * SHA-256 nu se casse en quelques minutes sur l'espace IPv4, d'où le sel.
 * À défaut de sel dédié, la clé de service fait l'affaire — elle est toujours
 * présente dans l'environnement de la fonction et ne quitte pas le serveur.
 */
async function clientIpHash(req: Request): Promise<string | null> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (!ip) return null;

  const salt = Deno.env.get("WEBAUTHN_IP_SALT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return b64uEncode(new Uint8Array(digest));
}

/** true = trop de demandes depuis cette empreinte sur la dernière minute. */
async function isRateLimited(ipHash: string | null): Promise<boolean> {
  if (!ipHash) return false;

  const { count } = await admin
    .from("webauthn_challenges")
    .select("id", { count: "exact", head: true })
    .eq("client_ip_hash", ipHash)
    .gt("created_at", new Date(Date.now() - RATE_WINDOW_MS).toISOString());

  return (count ?? 0) >= RATE_MAX_PER_WINDOW;
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * Rôle admin ACTIF, ou null. Utilisé aussi bien à l'enrôlement qu'à la
 * connexion : une clé valide ne suffit jamais, le rôle doit exister et le
 * compte ne pas être désactivé.
 */
async function activeAdminRole(userId: string): Promise<string | null> {
  const { data } = await admin
    .from("user_roles")
    .select("role, is_disabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || data.is_disabled) return null;
  return data.role as string;
}

/** Admin authentifié à partir du header Authorization, ou null. */
async function callerFromJwt(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const scoped = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data, error } = await scoped.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** Stocke un défi à usage unique. */
async function storeChallenge(
  challenge: string,
  purpose: string,
  userId: string | null,
  ipHash: string | null = null,
) {
  const { error } = await admin.from("webauthn_challenges").insert({
    challenge,
    purpose,
    user_id: userId,
    client_ip_hash: ipHash,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(`challenge non enregistré : ${error.message}`);
}

/**
 * Consomme un défi. Retourne la ligne si — et seulement si — il existe, a le
 * bon usage, n'a jamais servi et n'est pas périmé. L'UPDATE conditionnel rend
 * la consommation atomique : deux requêtes simultanées ne peuvent pas réussir.
 */
async function consumeChallenge(challenge: string, purpose: string) {
  const { data } = await admin
    .from("webauthn_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("challenge", challenge)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("challenge, user_id")
    .maybeSingle();

  return data ?? null;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/** 1. Enrôlement — défi. Exige un admin déjà connecté. */
async function registerStart(req: Request, origin: string) {
  const user = await callerFromJwt(req);
  if (!user) return fail("Non authentifié", 401);
  if (!(await activeAdminRole(user.id))) return fail("Compte non autorisé", 403);

  // On exclut les clés déjà enrôlées : évite un doublon silencieux sur le
  // même téléphone.
  const { data: existing } = await admin
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", user.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpIdFor(origin),
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.id,
    userDisplayName: user.email ?? "Administrateur",
    // Pas d'attestation : on n'a aucun besoin de savoir quelle marque de puce
    // c'est, et la demander ajoute un écran de consentement inutile.
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      transports: c.transports ?? undefined,
    })),
    authenticatorSelection: {
      // « découvrable » : le téléphone connaît le compte, donc l'écran de
      // connexion n'a aucun email à demander.
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
  });

  await storeChallenge(options.challenge, "registration", user.id);
  return json({ success: true, options });
}

/** 2. Enrôlement — vérification et enregistrement de la clé publique. */
async function registerFinish(req: Request, origin: string, body: Record<string, unknown>) {
  const user = await callerFromJwt(req);
  if (!user) return fail("Non authentifié", 401);
  if (!(await activeAdminRole(user.id))) return fail("Compte non autorisé", 403);

  const response = body.response as Record<string, unknown> | undefined;
  if (!response) return fail("Réponse manquante");

  const expected = await consumeChallenge(String(body.challenge ?? ""), "registration");
  if (!expected || expected.user_id !== user.id) {
    return fail("Défi invalide ou expiré. Réessayez.");
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      // deno-lint-ignore no-explicit-any
      response: response as any,
      expectedChallenge: expected.challenge,
      expectedOrigin: origin,
      expectedRPID: rpIdFor(origin),
      requireUserVerification: true,
    });
  } catch (error) {
    return fail(`Vérification échouée : ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return fail("Vérification échouée");
  }

  const { credential, credentialBackedUp } = verification.registrationInfo;

  const { error } = await admin.from("webauthn_credentials").insert({
    user_id: user.id,
    credential_id: credential.id,
    public_key: b64uEncode(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? null,
    backed_up: credentialBackedUp,
    device_label: deviceLabelFrom(req.headers.get("user-agent")),
  });

  if (error) {
    // 23505 = cette clé est déjà enrôlée : ce n'est pas une erreur pour
    // l'utilisateur, son appareil est simplement déjà en place.
    if (error.code === "23505") return json({ success: true, alreadyRegistered: true });
    return fail(`Enregistrement impossible : ${error.message}`, 500);
  }

  await admin.from("admin_audit_logs").insert({
    admin_user_id: user.id,
    action_type: "register_passkey",
    target_type: "admin_user",
    target_id: user.id,
    details: { description: "Ajout d'une clé d'accès (passkey)" },
  });

  return json({ success: true });
}

/** 3. Connexion — défi. Public par nécessité : personne n'est connecté. */
async function loginStart(req: Request, origin: string) {
  const ipHash = await clientIpHash(req);
  if (await isRateLimited(ipHash)) {
    return fail("Trop de tentatives. Réessayez dans une minute.", 429);
  }

  const options = await generateAuthenticationOptions({
    rpID: rpIdFor(origin),
    userVerification: "required",
    // Vide : la clé est « découvrable », c'est le téléphone qui annonce le
    // compte. Aucun email n'est demandé, donc rien à énumérer ici.
    allowCredentials: [],
  });

  await storeChallenge(options.challenge, "authentication", null, ipHash);
  // Entretien opportuniste, sans cron dédié.
  void admin.rpc("purge_webauthn_challenges");

  return json({ success: true, options });
}

/** 4. Connexion — vérification de la signature puis ouverture de session. */
async function loginFinish(origin: string, body: Record<string, unknown>) {
  const response = body.response as Record<string, unknown> | undefined;
  if (!response) return fail("Réponse manquante");

  const expected = await consumeChallenge(String(body.challenge ?? ""), "authentication");
  if (!expected) return fail("Défi invalide ou expiré. Réessayez.");

  const credentialId = String(response.id ?? "");
  const { data: stored } = await admin
    .from("webauthn_credentials")
    .select("id, user_id, credential_id, public_key, counter, transports")
    .eq("credential_id", credentialId)
    .maybeSingle();

  if (!stored) return fail("Clé d'accès inconnue", 401);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      // deno-lint-ignore no-explicit-any
      response: response as any,
      expectedChallenge: expected.challenge,
      expectedOrigin: origin,
      expectedRPID: rpIdFor(origin),
      credential: {
        id: stored.credential_id,
        publicKey: b64uDecode(stored.public_key),
        counter: Number(stored.counter),
        transports: stored.transports ?? undefined,
      },
      requireUserVerification: true,
    });
  } catch (error) {
    return fail(`Vérification échouée : ${error instanceof Error ? error.message : String(error)}`, 401);
  }

  if (!verification.verified) return fail("Vérification échouée", 401);

  // Anti-clonage : un compteur qui recule (ou stagne à une valeur non nulle)
  // signale une copie de la clé. Les authenticators iOS/Android renvoient 0 en
  // permanence — dans ce cas le contrôle ne s'applique pas.
  const newCounter = verification.authenticationInfo.newCounter;
  if (!isCounterAcceptable(Number(stored.counter), newCounter)) {
    return fail("Clé d'accès rejetée (compteur invalide). Contactez un administrateur.", 401);
  }

  // Avance du compteur AVANT toute session, et sous verrou optimiste.
  //
  // La lecture du compteur et son écriture sont deux requêtes distinctes : sans
  // le `.eq("counter", …)` ci-dessous, deux assertions simultanées portant le
  // même compteur passeraient toutes les deux le contrôle anti-clonage et
  // repartiraient chacune avec une session d'admin — exactement ce que le
  // compteur est censé empêcher. Le `WHERE counter = <valeur lue>` fait qu'une
  // seule des deux peut gagner ; l'autre ne met rien à jour et est refusée.
  //
  // Cas iOS/Android (compteur toujours 0) : l'ancienne et la nouvelle valeur
  // valent 0, la condition reste vraie, rien n'est refusé à tort.
  const { data: bumped } = await admin
    .from("webauthn_credentials")
    .update({ counter: newCounter, last_used_at: new Date().toISOString() })
    .eq("id", stored.id)
    .eq("counter", stored.counter)
    .select("id")
    .maybeSingle();

  if (!bumped) {
    return fail("Clé d'accès rejetée (utilisation concurrente détectée). Réessayez.", 401);
  }

  // Le rôle fait toujours foi, même avec une signature parfaite.
  const role = await activeAdminRole(stored.user_id);
  if (!role) return fail("Compte non autorisé", 403);

  const { data: userData } = await admin.auth.admin.getUserById(stored.user_id);
  const email = userData?.user?.email;
  if (!email) return fail("Compte sans adresse email", 500);

  // ── Ouverture de la session ──
  // Supabase n'expose pas d'API « voici ma preuve, donne-moi une session ».
  // On génère donc un jeton à usage unique côté serveur et on le consomme
  // immédiatement. Ce bloc n'est atteignable qu'après TOUTES les vérifications
  // ci-dessus — c'est ce qui l'empêche d'être une machine à sessions.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !link?.properties?.hashed_token) {
    return fail("Ouverture de session impossible", 500);
  }

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: verified, error: otpError } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });

  if (otpError || !verified.session) return fail("Ouverture de session impossible", 500);

  return json({
    success: true,
    session: {
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    },
  });
}

// ─── Entrée ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Méthode non autorisée", 405);

  const origin = resolveOrigin(req);
  if (!origin) return fail("Origine non autorisée", 403);

  const action = new URL(req.url).searchParams.get("action");

  let body: Record<string, unknown> = {};
  if (action !== "login/start" && action !== "register/start") {
    try {
      body = await req.json();
    } catch {
      return fail("Corps de requête invalide");
    }
  }

  try {
    switch (action) {
      case "register/start":
        return await registerStart(req, origin);
      case "register/finish":
        return await registerFinish(req, origin, body);
      case "login/start":
        return await loginStart(req, origin);
      case "login/finish":
        return await loginFinish(origin, body);
      default:
        return fail("Action inconnue");
    }
  } catch (error) {
    console.error("[passkey]", action, error);
    return fail("Erreur inattendue", 500);
  }
});
