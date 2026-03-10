import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateClient } from '@/hooks/useClientManagement';
import { Loader2, Check, Copy } from 'lucide-react';

// ============================================================
// BONZINI ADMIN — FORMULAIRE NOUVEAU CLIENT (redesign)
// 3 étapes : Identité → Contact → Vérification
// Pas de Genre, boutons toujours visibles, bottom nav masquée
// ============================================================

const V = '#A947FE'; // violet
const G = '#F3A745'; // gold
const O = '#FE560D'; // orange
const GR = '#34d399'; // green

const t = {
  bg: '#f8f6fa',
  card: '#ffffff',
  text: '#1a1028',
  sub: '#7a7290',
  dim: '#c4bdd0',
  border: '#ebe6f0',
  inputBg: '#f8f6fa',
};

const COUNTRY_CODES: { country: string; code: string }[] = [
  { country: 'Cameroun', code: '+237' },
  { country: 'Gabon', code: '+241' },
  { country: 'Tchad', code: '+235' },
  { country: 'RCA', code: '+236' },
  { country: 'Congo', code: '+242' },
];

const STEPS = [
  { num: 1, label: 'Identité' },
  { num: 2, label: 'Contact' },
  { num: 3, label: 'Vérification' },
];

interface FormData {
  prenom: string;
  nom: string;
  entreprise: string;
  phone: string;
  email: string;
  pays: string;
  ville: string;
}

const baseInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '16px 18px',
  borderRadius: 12,
  fontSize: 17,
  fontWeight: 600,
  color: t.text,
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
  background: t.inputBg,
};

const labelStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: t.text,
  marginBottom: 6,
  display: 'block',
};

const optStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: t.dim,
  marginLeft: 4,
};

export function MobileCreateClient() {
  const navigate = useNavigate();
  const createClientMutation = useCreateClient();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    prenom: '',
    nom: '',
    entreprise: '',
    phone: '',
    email: '',
    pays: 'Cameroun',
    ville: '',
  });
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Success state
  const [tempPassword, setTempPassword] = useState('');
  const [createdClientId, setCreatedClientId] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const set = (k: keyof FormData, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // Country code derived from selected country (auto-sync)
  const countryCode = COUNTRY_CODES.find(c => c.country === form.pays)?.code ?? '+237';

  // Validation per step
  const canNext =
    step === 1
      ? form.prenom.trim().length > 0 && form.nom.trim().length > 0
      : step === 2
        ? form.phone.trim().length >= 9
        : true;

  const handleNext = () => {
    if (step < 3 && canNext) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
  };

  const handleCreateClient = async () => {
    try {
      // Build full phone number with country code, cleaned
      const cleanPhone = `${countryCode}${form.phone.trim()}`.replace(/[\s\-\.\(\)]/g, '');

      const result = await createClientMutation.mutateAsync({
        firstName: form.prenom.trim(),
        lastName: form.nom.trim(),
        company: form.entreprise.trim() || undefined,
        whatsappNumber: cleanPhone,
        email: form.email.trim() || undefined,
        country: form.pays,
        city: form.ville.trim() || undefined,
      });

      if (result.tempPassword) {
        setTempPassword(result.tempPassword);
        setCreatedClientId(result.clientId || '');
        setIsSuccess(true);
      }
    } catch {
      // Error is handled by the mutation (toast notification)
    }
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const inputStyle = (fieldName: string): React.CSSProperties => ({
    ...baseInputStyle,
    border: `1.5px solid ${focusedField === fieldName ? V : t.border}`,
  });

  // ── ÉCRAN SUCCÈS ──────────────────────────────────────────
  if (isSuccess) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        background: t.bg, maxWidth: 560, margin: '0 auto',
        fontFamily: "'DM Sans', sans-serif", color: t.text, overflow: 'hidden',
      }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

        <div style={{ flex: 1, overflowY: 'auto', padding: '40px 20px 20px' }}>
          {/* Icône succès */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: `${GR}18`, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Check size={32} color={GR} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Client créé avec succès</div>
            <div style={{ fontSize: 14, color: t.sub, marginTop: 4 }}>
              {form.prenom} {form.nom} peut maintenant se connecter
            </div>
          </div>

          {/* Mot de passe temporaire */}
          <div style={{
            background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 14, padding: 16, marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: t.sub, marginBottom: 8 }}>Mot de passe temporaire</div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: t.bg, borderRadius: 10, padding: '14px 16px',
            }}>
              <code style={{ fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: '0.04em' }}>
                {tempPassword}
              </code>
              <button
                onClick={handleCopyPassword}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                {passwordCopied ? <Check size={20} color={GR} /> : <Copy size={20} color={t.sub} />}
              </button>
            </div>
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 10,
              background: `${G}10`, border: `1px solid ${G}20`,
              fontSize: 12, color: t.sub, lineHeight: 1.5,
            }}>
              Ce mot de passe ne sera plus affiché. Transmettez-le au client via WhatsApp.
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => navigate(`/m/clients/${createdClientId}`)}
              style={{
                padding: '17px 0', borderRadius: 12,
                background: V, border: 'none',
                fontSize: 16, fontWeight: 800, color: '#fff',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Voir la fiche client
            </button>
            <button
              onClick={() => navigate('/m/clients')}
              style={{
                padding: '17px 0', borderRadius: 12,
                background: 'none', border: `1px solid ${t.border}`,
                fontSize: 15, fontWeight: 700, color: t.sub,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Retour à la liste
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FORMULAIRE 3 ÉTAPES ───────────────────────────────────
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: t.bg, maxWidth: 560, margin: '0 auto',
      fontFamily: "'DM Sans', sans-serif", color: t.text,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* HEADER — fixe, ne scroll pas */}
      <div style={{
        flexShrink: 0, background: t.card,
        borderBottom: `1px solid ${t.border}`,
        padding: '14px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <span
            onClick={() => navigate('/m/clients')}
            style={{ fontSize: 22, color: t.sub, cursor: 'pointer', marginRight: 14, fontWeight: 300 }}
          >
            ‹
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Nouveau client</span>
        </div>

        {/* Barre de progression 3 segments */}
        <div style={{ display: 'flex', gap: 6 }}>
          {STEPS.map(s => (
            <div key={s.num} style={{ flex: 1 }}>
              <div style={{
                height: 3, borderRadius: 2,
                background: step >= s.num ? V : t.border,
                transition: 'background 0.3s',
              }} />
              <div style={{
                fontSize: 10,
                fontWeight: step === s.num ? 800 : 500,
                color: step === s.num ? V : t.dim,
                marginTop: 5, textAlign: 'center',
              }}>
                {s.num}. {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENU — scrollable entre le header et le footer */}
      <div style={{
        flex: 1, overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '20px 20px 0',
      } as React.CSSProperties}>

        {/* ── ÉTAPE 1 : IDENTITÉ ─────────────────────────── */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>
              Qui est votre client ?
            </div>
            <div style={{ fontSize: 14, color: t.sub, marginBottom: 28, lineHeight: 1.4 }}>
              Prénom, nom et entreprise
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>
                Prénom <span style={{ color: O }}>*</span>
              </label>
              <input
                style={inputStyle('prenom')}
                placeholder="Ex: Fabrice"
                value={form.prenom}
                onChange={e => set('prenom', e.target.value)}
                onFocus={() => setFocusedField('prenom')}
                onBlur={() => setFocusedField(null)}
                autoComplete="given-name"
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>
                Nom <span style={{ color: O }}>*</span>
              </label>
              <input
                style={inputStyle('nom')}
                placeholder="Ex: Bienvenue"
                value={form.nom}
                onChange={e => set('nom', e.target.value)}
                onFocus={() => setFocusedField('nom')}
                onBlur={() => setFocusedField(null)}
                autoComplete="family-name"
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>
                Entreprise <span style={optStyle}>optionnel</span>
              </label>
              <input
                style={inputStyle('entreprise')}
                placeholder="Ex: Jako Cargo SARL"
                value={form.entreprise}
                onChange={e => set('entreprise', e.target.value)}
                onFocus={() => setFocusedField('entreprise')}
                onBlur={() => setFocusedField(null)}
                autoComplete="organization"
              />
            </div>
          </div>
        )}

        {/* ── ÉTAPE 2 : CONTACT ──────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>
              Comment le joindre ?
            </div>
            <div style={{ fontSize: 14, color: t.sub, marginBottom: 28, lineHeight: 1.4 }}>
              WhatsApp, email et localisation
            </div>

            {/* WhatsApp avec sélecteur de code pays */}
            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>
                WhatsApp <span style={{ color: O }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '14px 12px', borderRadius: 12,
                  border: `1.5px solid ${t.border}`, background: t.inputBg,
                  fontSize: 14, fontWeight: 600, color: t.text,
                  flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  {countryCode}
                  <span style={{ fontSize: 9, color: t.dim, marginLeft: 2 }}>▾</span>
                </div>
                <input
                  style={{ ...inputStyle('phone'), flex: 1 }}
                  placeholder="6XX XXX XXX"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  type="tel"
                  inputMode="numeric"
                />
              </div>
              <div style={{ fontSize: 11, color: t.dim, marginTop: 4 }}>
                Le client recevra son mot de passe par WhatsApp
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>
                Email <span style={optStyle}>optionnel</span>
              </label>
              <input
                style={inputStyle('email')}
                placeholder="fabrice@jakocargo.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                type="email"
                autoComplete="email"
              />
            </div>

            {/* Pays — le changement met à jour le code pays WhatsApp */}
            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>
                Pays <span style={{ color: O }}>*</span>
              </label>
              <select
                style={{
                  ...inputStyle('pays'),
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  cursor: 'pointer',
                  paddingRight: 36,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%237a7290' stroke-width='1.5'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                } as React.CSSProperties}
                value={form.pays}
                onChange={e => set('pays', e.target.value)}
                onFocus={() => setFocusedField('pays')}
                onBlur={() => setFocusedField(null)}
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.country} value={c.country}>{c.country}</option>
                ))}
              </select>
            </div>

            {/* Ville */}
            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>
                Ville <span style={optStyle}>optionnel</span>
              </label>
              <input
                style={inputStyle('ville')}
                placeholder="Ex: Douala"
                value={form.ville}
                onChange={e => set('ville', e.target.value)}
                onFocus={() => setFocusedField('ville')}
                onBlur={() => setFocusedField(null)}
              />
            </div>
          </div>
        )}

        {/* ── ÉTAPE 3 : VÉRIFICATION ─────────────────────── */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>
              Tout est correct ?
            </div>
            <div style={{ fontSize: 14, color: t.sub, marginBottom: 28, lineHeight: 1.4 }}>
              Vérifiez avant de créer le compte
            </div>

            <div style={{
              padding: '20px 16px', borderRadius: 14,
              background: t.card, border: `1px solid ${t.border}`,
            }}>
              {/* Initiales + nom complet */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                marginBottom: 16, paddingBottom: 16,
                borderBottom: `1px solid ${t.border}`,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${V}12`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, color: V, flexShrink: 0,
                }}>
                  {(form.prenom[0] ?? '').toUpperCase()}{(form.nom[0] ?? '').toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>
                    {form.prenom} {form.nom}
                  </div>
                  {form.entreprise && (
                    <div style={{ fontSize: 12, color: t.sub, marginTop: 1 }}>{form.entreprise}</div>
                  )}
                </div>
              </div>

              {/* Tableau récapitulatif */}
              {(
                [
                  { label: 'WhatsApp', value: `${countryCode} ${form.phone}` },
                  form.email ? { label: 'Email', value: form.email } : null,
                  { label: 'Pays', value: form.pays },
                  form.ville ? { label: 'Ville', value: form.ville } : null,
                ] as ({ label: string; value: string } | null)[]
              )
                .filter((r): r is { label: string; value: string } => r !== null)
                .map((row, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
                  }}>
                    <span style={{ fontSize: 13, color: t.sub }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{row.value}</span>
                  </div>
                ))}
            </div>

            {/* Note mot de passe */}
            <div style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 12,
              background: `${G}08`, border: `1px solid ${G}18`,
              fontSize: 12, color: t.sub, lineHeight: 1.5,
            }}>
              Un mot de passe temporaire sera envoyé au client par WhatsApp. Il devra le changer lors de sa première connexion.
            </div>
          </div>
        )}
      </div>

      {/* FOOTER — boutons TOUJOURS visibles, jamais cachés */}
      <div style={{
        flexShrink: 0, padding: '12px 20px 20px',
        background: t.card, borderTop: `1px solid ${t.border}`,
        display: 'flex', gap: 10,
      }}>
        {/* Bouton Retour — absent à l'étape 1 */}
        {step > 1 && (
          <button
            onClick={handleBack}
            style={{
              flex: 1, padding: '17px 0', borderRadius: 12,
              background: 'none', border: `1px solid ${t.border}`,
              fontSize: 15, fontWeight: 700, color: t.sub,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Retour
          </button>
        )}

        {/* Bouton Continuer / Créer le client */}
        <button
          onClick={step < 3 ? handleNext : handleCreateClient}
          disabled={!canNext || createClientMutation.isPending}
          style={{
            flex: step === 1 ? 1 : 1.5,
            padding: '17px 0', borderRadius: 12,
            background: canNext && !createClientMutation.isPending ? V : t.border,
            border: 'none',
            fontSize: 16, fontWeight: 800,
            color: canNext && !createClientMutation.isPending ? '#fff' : t.dim,
            cursor: canNext && !createClientMutation.isPending ? 'pointer' : 'not-allowed',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'background 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {createClientMutation.isPending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Création...
            </>
          ) : step === 3 ? (
            'Créer le client'
          ) : (
            `Continuer (${step}/3)`
          )}
        </button>
      </div>
    </div>
  );
}
