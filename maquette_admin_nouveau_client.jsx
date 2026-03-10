import { useState } from "react";

// ============================================================
// BONZINI ADMIN — FORMULAIRE NOUVEAU CLIENT (redesign)
// 3 étapes : Identité → Contact → Vérification
// Pas de Genre, pas d'émojis, boutons toujours visibles
// ============================================================

const V = "#A947FE", G = "#F3A745", O = "#FE560D", GR = "#34d399";

const themes = {
  light: {
    bg: "#f8f6fa", card: "#ffffff",
    text: "#1a1028", sub: "#7a7290", dim: "#c4bdd0",
    border: "#ebe6f0", inputBg: "#f8f6fa",
    headBg: "#ffffff",
  },
};

export default function App() {
  const t = themes.light;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    prenom: "", nom: "", entreprise: "",
    phone: "", email: "", pays: "Cameroun", ville: "",
  });

  const set = (k, v) => setForm({ ...form, [k]: v });
  const canNext = step === 1 ? form.prenom && form.nom : step === 2 ? form.phone : true;

  const steps = [
    { num: 1, label: "Identité" },
    { num: 2, label: "Contact" },
    { num: 3, label: "Vérification" },
  ];

  const inputStyle = {
    width: "100%", padding: "16px 18px", borderRadius: 12,
    border: `1px solid ${t.border}`, background: t.inputBg,
    fontSize: 17, fontWeight: 600, color: t.text,
    fontFamily: "'DM Sans', sans-serif", outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6, display: "block",
  };

  const optStyle = {
    fontSize: 12, fontWeight: 500, color: t.dim, marginLeft: 4,
  };

  return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      overflow: "hidden", background: t.bg, maxWidth: 560, margin: "0 auto",
      fontFamily: "'DM Sans', sans-serif", color: t.text,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{
        flexShrink: 0, background: t.headBg,
        borderBottom: `1px solid ${t.border}`,
        padding: "14px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 22, color: t.sub, cursor: "pointer", marginRight: 14, fontWeight: 300 }}>‹</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Nouveau client</span>
        </div>

        {/* Progress bar with labels */}
        <div style={{ display: "flex", gap: 6 }}>
          {steps.map(s => (
            <div key={s.num} style={{ flex: 1 }}>
              <div style={{
                height: 3, borderRadius: 2,
                background: step >= s.num ? V : t.border,
                transition: "background 0.3s",
              }} />
              <div style={{
                fontSize: 10, fontWeight: step === s.num ? 800 : 500,
                color: step === s.num ? V : t.dim,
                marginTop: 5, textAlign: "center",
              }}>
                {s.num}. {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FORM CONTENT */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "20px 20px 0" }}>

        {/* ── ÉTAPE 1 : IDENTITÉ ── */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>Qui est votre client ?</div>
            <div style={{ fontSize: 14, color: t.sub, marginBottom: 28, lineHeight: 1.4 }}>Prénom, nom et entreprise</div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Prénom <span style={{ color: O }}>*</span></label>
              <input
                style={inputStyle}
                placeholder="Ex: Fabrice"
                value={form.prenom}
                onChange={e => set("prenom", e.target.value)}
                onFocus={e => e.target.style.borderColor = V}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Nom <span style={{ color: O }}>*</span></label>
              <input
                style={inputStyle}
                placeholder="Ex: Bienvenue"
                value={form.nom}
                onChange={e => set("nom", e.target.value)}
                onFocus={e => e.target.style.borderColor = V}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Entreprise <span style={optStyle}>optionnel</span></label>
              <input
                style={inputStyle}
                placeholder="Ex: Jako Cargo SARL"
                value={form.entreprise}
                onChange={e => set("entreprise", e.target.value)}
                onFocus={e => e.target.style.borderColor = V}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>
          </div>
        )}

        {/* ── ÉTAPE 2 : CONTACT ── */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>Comment le joindre ?</div>
            <div style={{ fontSize: 14, color: t.sub, marginBottom: 28, lineHeight: 1.4 }}>WhatsApp, email et localisation</div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>WhatsApp <span style={{ color: O }}>*</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "14px 12px", borderRadius: 12,
                  border: `1px solid ${t.border}`, background: t.inputBg,
                  fontSize: 14, fontWeight: 600, color: t.text, flexShrink: 0,
                  cursor: "pointer",
                }}>
                  +237 <span style={{ fontSize: 10, color: t.dim }}>v</span>
                </div>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="6XX XXX XXX"
                  value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  onFocus={e => e.target.style.borderColor = V}
                  onBlur={e => e.target.style.borderColor = t.border}
                  type="tel"
                />
              </div>
              <div style={{ fontSize: 11, color: t.dim, marginTop: 4 }}>Le client recevra son mot de passe par WhatsApp</div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Email <span style={optStyle}>optionnel</span></label>
              <input
                style={inputStyle}
                placeholder="fabrice@jakocargo.com"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                onFocus={e => e.target.style.borderColor = V}
                onBlur={e => e.target.style.borderColor = t.border}
                type="email"
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Pays <span style={{ color: O }}>*</span></label>
              <select
                style={{ ...inputStyle, appearance: "none", cursor: "pointer", paddingRight: 36, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%237a7290' stroke-width='1.5'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}
                value={form.pays}
                onChange={e => set("pays", e.target.value)}
              >
                <option>Cameroun</option>
                <option>Gabon</option>
                <option>Tchad</option>
                <option>RCA</option>
                <option>Congo</option>
              </select>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Ville <span style={optStyle}>optionnel</span></label>
              <input
                style={inputStyle}
                placeholder="Ex: Douala"
                value={form.ville}
                onChange={e => set("ville", e.target.value)}
                onFocus={e => e.target.style.borderColor = V}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>
          </div>
        )}

        {/* ── ÉTAPE 3 : VÉRIFICATION ── */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>Tout est correct ?</div>
            <div style={{ fontSize: 14, color: t.sub, marginBottom: 28, lineHeight: 1.4 }}>Vérifiez avant de créer le compte</div>

            <div style={{
              padding: "20px 16px", borderRadius: 14,
              background: t.card, border: `1px solid ${t.border}`,
            }}>
              {/* Name header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${V}10`, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 800, color: V,
                }}>
                  {(form.prenom?.[0] || "").toUpperCase()}{(form.nom?.[0] || "").toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{form.prenom} {form.nom}</div>
                  {form.entreprise && <div style={{ fontSize: 12, color: t.sub, marginTop: 1 }}>{form.entreprise}</div>}
                </div>
              </div>

              {/* Details */}
              {[
                { label: "WhatsApp", value: form.phone ? `+237 ${form.phone}` : "—" },
                form.email && { label: "Email", value: form.email },
                { label: "Pays", value: form.pays },
                form.ville && { label: "Ville", value: form.ville },
              ].filter(Boolean).map((r, i, arr) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : "none",
                }}>
                  <span style={{ fontSize: 13, color: t.sub }}>{r.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Info about password */}
            <div style={{
              marginTop: 12, padding: "12px 14px", borderRadius: 12,
              background: `${G}08`, border: `1px solid ${G}15`,
              fontSize: 12, color: t.sub, lineHeight: 1.5,
            }}>
              Un mot de passe temporaire sera envoyé au client par WhatsApp. Il devra le changer lors de sa première connexion.
            </div>
          </div>
        )}
      </div>

      {/* FOOTER — boutons TOUJOURS visibles */}
      <div style={{
        flexShrink: 0, padding: "12px 20px 20px",
        background: t.card, borderTop: `1px solid ${t.border}`,
        display: "flex", gap: 10,
      }}>
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} style={{
            flex: 1, padding: "17px 0", borderRadius: 12,
            background: "none", border: `1px solid ${t.border}`,
            fontSize: 15, fontWeight: 700, color: t.sub, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}>Retour</button>
        )}
        <button
          onClick={() => step < 3 ? setStep(step + 1) : null}
          disabled={!canNext}
          style={{
            flex: step === 1 ? 1 : 1.5, padding: "17px 0", borderRadius: 12,
            background: canNext ? V : t.border,
            border: "none",
            fontSize: 16, fontWeight: 800,
            color: canNext ? "#fff" : t.dim,
            cursor: canNext ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans', sans-serif",
            transition: "background 0.2s",
          }}
        >
          {step === 3 ? "Créer le client" : `Continuer (${step}/3)`}
        </button>
      </div>
    </div>
  );
}
