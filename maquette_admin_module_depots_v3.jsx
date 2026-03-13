import { useState, useMemo } from "react";

// ============================================================
// BONZINI ADMIN — MODULE DÉPÔTS V3
// Entonnoir filtre · Présets période · Pas de limites
// Coordonnées dans le récap · Écran succès · DM Sans
// ============================================================

const V = "#A947FE", G = "#F3A745", O = "#FE560D", GR = "#34d399";
const RED = "#ef4444", BLUE = "#3b82f6";
const t = { bg: "#f5f3f7", card: "#fff", text: "#1a1028", sub: "#7a7290", dim: "#c4bdd0", border: "#ebe6f0" };
function fmt(n) { return Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

const FAMILIES = {
  BANK: { name: "Banque", color: "#1e3a5f", bg: "#1e3a5f", letter: "B" },
  AGENCY_BONZINI: { name: "Agence Bonzini", color: V, bg: V, letter: "A" },
  ORANGE_MONEY: { name: "Orange Money", color: "#ff6600", bg: "#ff6600", letter: "O" },
  MTN_MONEY: { name: "MTN MoMo", color: "#ffcb05", bg: "#ffcb05", letter: "M", dark: true },
  WAVE: { name: "Wave", color: "#1dc3e3", bg: "#1dc3e3", letter: "W" },
};

const METHOD_INFO = {
  bank_transfer: { family: "BANK", short: "Virement" },
  bank_cash: { family: "BANK", short: "Cash banque" },
  agency_cash: { family: "AGENCY_BONZINI", short: "Agence" },
  om_transfer: { family: "ORANGE_MONEY", short: "OM Transfert" },
  om_withdrawal: { family: "ORANGE_MONEY", short: "OM Marchand" },
  mtn_transfer: { family: "MTN_MONEY", short: "MTN Transfert" },
  mtn_withdrawal: { family: "MTN_MONEY", short: "MTN Marchand" },
  wave: { family: "WAVE", short: "Wave" },
};

const STATUS = {
  created: { label: "Créé", color: t.sub },
  proof_submitted: { label: "Preuve envoyée", color: BLUE },
  admin_review: { label: "En vérification", color: V },
  validated: { label: "Validé", color: GR },
  rejected: { label: "Rejeté", color: RED },
  pending_correction: { label: "À corriger", color: O },
};

const DEPOSITS = [
  { id: 1, ref: "BZ-DP-2026-0033", client: "Johann Soh", method: "wave", amount: 2000000, status: "created", proofs: 0, time: "13 min", sla: "fresh" },
  { id: 2, ref: "BZ-DP-2026-0032", client: "Royal Trading", method: "bank_cash", amount: 28581000, status: "validated", proofs: 2, time: "5h", sla: null, bank: "UBA Cameroun" },
  { id: 3, ref: "BZ-DP-2026-0031", client: "Billy Tankeu", method: "bank_cash", amount: 3300000, status: "validated", proofs: 1, time: "6h", sla: null },
  { id: 4, ref: "BZ-DP-2026-0030", client: "Cedric Ayemeli", method: "mtn_transfer", amount: 185000, status: "validated", proofs: 1, time: "6h", sla: null },
  { id: 5, ref: "BZ-DP-2026-0029", client: "Faustin Tamko", method: "om_transfer", amount: 500000, status: "proof_submitted", proofs: 2, time: "5j", sla: "overdue" },
  { id: 6, ref: "BZ-DP-2026-0028", client: "Fabrice Bienvenue", method: "om_transfer", amount: 300000, status: "validated", proofs: 2, time: "5j", sla: null },
  { id: 7, ref: "BZ-DP-2026-0027", client: "Fabrice Bienvenue", method: "bank_cash", amount: 4520000, status: "validated", proofs: 1, time: "5j", sla: null },
  { id: 8, ref: "BZ-DP-2026-0026", client: "Anderson Mouale", method: "agency_cash", amount: 500000, status: "pending_correction", proofs: 0, time: "6j", sla: "overdue" },
];

const CLIENTS = [
  { id: 1, name: "Johann Soh", initials: "JS", phone: "+237 677 889 900" },
  { id: 2, name: "Fabrice Bienvenue", initials: "FB", phone: "+237 620 666 860" },
  { id: 3, name: "Faustin Tamko", initials: "FT", phone: "+237 694 212 903" },
  { id: 4, name: "Royal Trading", initials: "RT", phone: "+86 137 040 032" },
];

const BANKS = [
  { k: "ecobank", l: "Ecobank Cameroun", account: "30245039710", iban: "CM21 10029 80882 30245039710 53", swift: "ECOCMKAX" },
  { k: "cca", l: "CCA-BANK Cameroun", account: "00280298901", iban: "CM21 10039 18444 00280298901 57", swift: "CCAMCMCX" },
  { k: "uba", l: "UBA Cameroun", account: "14011000141", iban: "CM21 10033...", swift: "UNAFCMCX" },
  { k: "afriland", l: "Afriland First Bank", account: "00000020611", iban: "CM21 10005...", swift: "CCEICMCX" },
];

const AGENCIES = [
  { k: "bonapriso", l: "Douala — Bonapriso", addr: "Rue de la Joie, Bonapriso", hours: "Lun-Ven 8h-18h, Sam 9h-14h" },
  { k: "bonamoussadi", l: "Douala — Bonamoussadi", addr: "Carrefour Maetur", hours: "Lun-Ven 8h-18h, Sam 9h-14h" },
  { k: "yaounde", l: "Yaoundé — Centre", addr: "Avenue Kennedy", hours: "Lun-Ven 8h-18h, Sam 9h-13h" },
];

function MIcon({ family, size = 34 }) {
  const f = FAMILIES[family];
  if (!f) return null;
  return <div style={{ width: size, height: size, borderRadius: size * 0.26, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, color: f.dark ? "#1a1028" : "#fff", fontWeight: 900, flexShrink: 0 }}>{f.letter}</div>;
}

// Funnel SVG icon
function FunnelIcon({ color = "#7a7290", size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M1.5 2h13l-5 6v4.5L7.5 14V8L1.5 2z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return <button onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ padding: "2px 6px", borderRadius: 4, background: copied ? `${GR}15` : t.bg, border: `1px solid ${copied ? GR : t.border}`, fontSize: 9, fontWeight: 700, color: copied ? GR : t.sub, cursor: "pointer" }}>{copied ? "Copié" : "Copier"}</button>;
}

export default function App() {
  const [screen, setScreen] = useState("list");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [methodFilter, setMethodFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedDeposit, setSelectedDeposit] = useState(DEPOSITS[0]);
  const [showSuivi, setShowSuivi] = useState(false);

  // Form
  const [formStep, setFormStep] = useState(1);
  const [formClient, setFormClient] = useState(null);
  const [formAmount, setFormAmount] = useState("");
  const [formFamily, setFormFamily] = useState(null);
  const [formSubmethod, setFormSubmethod] = useState(null);
  const [formBank, setFormBank] = useState(null);
  const [formAgency, setFormAgency] = useState(null);
  const [formDone, setFormDone] = useState(false);

  const stats = { toProcess: DEPOSITS.filter(d => ["proof_submitted", "admin_review"].includes(d.status)).length, correction: DEPOSITS.filter(d => d.status === "pending_correction").length, validated: DEPOSITS.filter(d => d.status === "validated").length, total: DEPOSITS.length };

  const filtered = useMemo(() => {
    let list = DEPOSITS;
    if (filter === "to_process") list = list.filter(d => ["proof_submitted", "admin_review"].includes(d.status));
    else if (filter === "correction") list = list.filter(d => d.status === "pending_correction");
    else if (filter === "validated") list = list.filter(d => d.status === "validated");
    else if (filter === "rejected") list = list.filter(d => d.status === "rejected");
    if (methodFilter !== "all") list = list.filter(d => METHOD_INFO[d.method]?.family === methodFilter);
    if (search) list = list.filter(d => d.client.toLowerCase().includes(search.toLowerCase()) || d.ref.includes(search));
    return list;
  }, [filter, search, methodFilter]);

  function resetForm() { setFormStep(1); setFormClient(null); setFormAmount(""); setFormFamily(null); setFormSubmethod(null); setFormBank(null); setFormAgency(null); setFormDone(false); }
  const formXAF = parseInt(formAmount) || 0;

  function getTotalSteps() {
    if (!formFamily) return 4;
    if (formFamily === "WAVE") return 4;
    if (formFamily === "AGENCY_BONZINI") return 5;
    if (formFamily === "BANK") return 6;
    return 5;
  }
  const totalSteps = getTotalSteps();

  function handleNext() {
    if (formStep === 3) { if (formFamily === "WAVE") { setFormStep(totalSteps); } else { setFormStep(4); } return; }
    if (formStep === 4) { if (formFamily === "BANK") { setFormStep(5); } else { setFormStep(totalSteps); } return; }
    if (formStep === 5) { setFormStep(totalSteps); return; }
    setFormStep(formStep + 1);
  }
  function handleBack() {
    if (formStep <= 1) { setScreen("list"); return; }
    if (formStep === totalSteps) { if (formFamily === "WAVE") setFormStep(3); else if (formFamily === "BANK") setFormStep(5); else if (formFamily === "AGENCY_BONZINI") setFormStep(4); else setFormStep(4); return; }
    setFormStep(formStep - 1);
  }

  const isRecap = formStep === totalSteps;
  const canNext = isRecap ? true : formStep === 1 ? !!formClient : formStep === 2 ? formXAF >= 10000 : formStep === 3 ? !!formFamily : formStep === 4 && formFamily === "BANK" ? !!formSubmethod : formStep === 4 && (formFamily === "ORANGE_MONEY" || formFamily === "MTN_MONEY") ? !!formSubmethod : formStep === 4 && formFamily === "AGENCY_BONZINI" ? !!formAgency : formStep === 5 && formFamily === "BANK" ? !!formBank : true;

  const selectedBankData = BANKS.find(b => b.k === formBank);
  const selectedAgencyData = AGENCIES.find(a => a.k === formAgency);

  // ═══════════════════════ SUCCESS SCREEN ═══════════════════════
  if (formDone) return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans',sans-serif", padding: "0 24px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${GR}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: GR, marginBottom: 16 }}>✓</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Dépôt créé</div>
      <div style={{ fontSize: 34, fontWeight: 900, color: t.text, letterSpacing: "-1.5px", marginTop: 6 }}>{fmt(formXAF)} XAF</div>
      <div style={{ fontSize: 14, color: t.sub, marginTop: 4 }}>pour {formClient?.name} via {FAMILIES[formFamily]?.name}</div>
      <div style={{ fontSize: 12, color: t.dim, marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>Le client peut maintenant ajouter ses preuves de dépôt depuis son application.</div>
      <div style={{ display: "flex", gap: 10, marginTop: 28, width: "100%" }}>
        <button onClick={() => { resetForm(); setScreen("list"); }} style={{ flex: 1, padding: "15px", borderRadius: 12, background: "none", border: `1px solid ${t.border}`, fontSize: 14, fontWeight: 700, color: t.sub, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Retour</button>
        <button style={{ flex: 1, padding: "15px", borderRadius: 12, background: GR, border: "none", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Voir la fiche</button>
      </div>
    </div>
  );

  // ═══════════════════════ LISTE ═══════════════════════
  if (screen === "list") return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: t.bg, maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans',sans-serif", color: t.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ flexShrink: 0, padding: "12px 20px", background: t.card, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Dépôts</span>
          <button onClick={() => { setScreen("new"); resetForm(); }} style={{ width: 40, height: 40, borderRadius: "50%", background: GR, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", boxShadow: `0 4px 12px ${GR}40` }}>+</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {/* KPIs */}
        <div style={{ padding: "12px 20px 0", display: "flex", gap: 6 }}>
          {[
            { label: "À traiter", value: stats.toProcess, color: BLUE, key: "to_process" },
            { label: "À corriger", value: stats.correction, color: O, key: "correction" },
            { label: "Validés", value: stats.validated, color: GR, key: "validated" },
          ].map(k => (
            <button key={k.key} onClick={() => setFilter(filter === k.key ? "all" : k.key)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", background: filter === k.key ? `${k.color}10` : t.card, outline: filter === k.key ? `2px solid ${k.color}` : `1px solid ${t.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.sub, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</div>
            </button>
          ))}
        </div>

        {/* Search + Funnel */}
        <div style={{ padding: "10px 20px 0", display: "flex", gap: 6 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", height: 42, borderRadius: 10, background: t.card, border: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 14, color: t.dim }}>Q</span>
            <input style={{ border: "none", background: "none", outline: "none", fontSize: 13, fontWeight: 500, color: t.text, width: "100%", fontFamily: "'DM Sans',sans-serif" }} placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} style={{ width: 42, height: 42, borderRadius: 10, border: "none", cursor: "pointer", background: showFilters ? `${V}10` : t.card, outline: showFilters ? `2px solid ${V}` : `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <FunnelIcon color={showFilters ? V : t.sub} />
            {(methodFilter !== "all" || periodFilter !== "all") && <div style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: V }} />}
          </button>
        </div>

        {/* Filtres avancés */}
        {showFilters && (
          <div style={{ margin: "8px 20px 0", padding: "12px", borderRadius: 12, background: t.card, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 6 }}>Méthode</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
              {[{ k: "all", l: "Toutes" }, { k: "BANK", l: "Banque" }, { k: "AGENCY_BONZINI", l: "Agence" }, { k: "ORANGE_MONEY", l: "Orange" }, { k: "MTN_MONEY", l: "MTN" }, { k: "WAVE", l: "Wave" }].map(m => (
                <button key={m.k} onClick={() => setMethodFilter(m.k)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer", background: methodFilter === m.k ? V : t.bg, color: methodFilter === m.k ? "#fff" : t.sub, fontSize: 11, fontWeight: 700 }}>{m.l}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 6 }}>Période</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
              {[
                { k: "all", l: "Toutes" },
                { k: "today", l: "Aujourd'hui" },
                { k: "yesterday", l: "Hier" },
                { k: "week", l: "Cette semaine" },
                { k: "month", l: "Ce mois" },
                { k: "custom", l: "Personnalisé" },
              ].map(p => (
                <button key={p.k} onClick={() => setPeriodFilter(p.k)} style={{ padding: "6px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: periodFilter === p.k ? V : t.bg, color: periodFilter === p.k ? "#fff" : t.sub, fontSize: 11, fontWeight: 700 }}>{p.l}</button>
              ))}
            </div>
            {periodFilter === "custom" && (
              <div style={{ display: "flex", gap: 6 }}>
                <input type="date" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${t.border}`, background: t.bg, fontSize: 12, fontWeight: 600, color: t.text, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
                <span style={{ display: "flex", alignItems: "center", fontSize: 12, color: t.dim }}>→</span>
                <input type="date" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${t.border}`, background: t.bg, fontSize: 12, fontWeight: 600, color: t.text, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
              </div>
            )}
          </div>
        )}

        {/* Chips */}
        <div style={{ padding: "10px 20px 0", display: "flex", gap: 4, overflowX: "auto" }}>
          {[{ k: "all", l: "Tous", c: stats.total }, { k: "to_process", l: "À traiter", c: stats.toProcess }, { k: "correction", l: "À corriger", c: stats.correction }, { k: "validated", l: "Validés", c: stats.validated }, { k: "rejected", l: "Rejetés" }].map(ch => (
            <button key={ch.k} onClick={() => setFilter(ch.k)} style={{ padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", background: filter === ch.k ? t.text : t.card, color: filter === ch.k ? "#fff" : t.sub, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4, outline: filter !== ch.k ? `1px solid ${t.border}` : "none" }}>
              {ch.l}{ch.c != null && <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 8, background: filter === ch.k ? "rgba(255,255,255,0.2)" : t.bg }}>{ch.c}</span>}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div style={{ padding: "10px 20px 100px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map(d => {
              const st = STATUS[d.status] || { label: d.status, color: t.sub };
              const info = METHOD_INFO[d.method];
              return (
                <button key={d.id} onClick={() => { setSelectedDeposit(d); setScreen("detail"); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, width: "100%", background: t.card, border: `1px solid ${t.border}`, cursor: "pointer", textAlign: "left" }}>
                  <MIcon family={info?.family} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.client}</span>
                      {d.proofs > 0 && <span style={{ fontSize: 9, color: t.dim }}>📎{d.proofs}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: t.dim, marginTop: 1 }}>{d.ref} · {info?.short}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{fmt(d.amount)} XAF</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
                      {d.sla === "overdue" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: RED, animation: "pulse 1.5s infinite" }} />}
                      {d.sla === "fresh" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: GR }} />}
                      <span style={{ fontSize: 10, fontWeight: 700, color: st.color, padding: "2px 6px", borderRadius: 4, background: `${st.color}10` }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 9, color: t.dim, marginTop: 1 }}>{d.time}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", background: t.card, borderTop: `1px solid ${t.border}`, padding: "6px 10px 18px" }}>
        {[{ icon: "⊞", label: "Accueil" }, { icon: "↓", label: "Dépôts", active: true, badge: stats.toProcess }, { icon: "↑", label: "Paiements", badge: 2 }, { icon: "⊕", label: "Clients" }, { icon: "···", label: "Plus" }].map((tab, i) => (
          <button key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "6px 0", position: "relative" }}>
            <div style={{ fontSize: 18, lineHeight: 1, color: tab.active ? GR : t.dim }}>{tab.icon}</div>
            <span style={{ fontSize: 9, fontWeight: tab.active ? 800 : 500, color: tab.active ? GR : t.sub }}>{tab.label}</span>
            {tab.badge > 0 && <div style={{ position: "absolute", top: 0, right: "50%", marginRight: -16, minWidth: 15, height: 15, borderRadius: 8, background: RED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#fff", padding: "0 3px" }}>{tab.badge}</div>}
            {tab.active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: GR, marginTop: 1 }} />}
          </button>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );

  // ═══════════════════════ FICHE ═══════════════════════
  if (screen === "detail") {
    const d = selectedDeposit; const st = STATUS[d.status] || { label: d.status, color: t.sub }; const info = METHOD_INFO[d.method]; const isLocked = ["validated", "rejected", "cancelled"].includes(d.status);
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: t.bg, maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans',sans-serif", color: t.text }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <div style={{ flexShrink: 0, padding: "10px 20px", background: t.card, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span onClick={() => setScreen("list")} style={{ fontSize: 18, color: t.sub, cursor: "pointer", fontWeight: 300 }}>‹</span><span style={{ fontSize: 14, fontWeight: 800 }}>{d.ref}</span></div>
            <button style={{ padding: "5px 12px", borderRadius: 7, background: GR, border: "none", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Relevé</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
            <span style={{ padding: "4px 10px", borderRadius: 6, background: `${st.color}10`, fontSize: 12, fontWeight: 800, color: st.color }}>{st.label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><MIcon family={info?.family} size={20} /><span style={{ fontSize: 12, fontWeight: 700 }}>{info?.short}</span></div>
          </div>
          <div style={{ padding: "20px 16px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, textAlign: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-1.5px", lineHeight: 1 }}>{fmt(d.amount)} <span style={{ fontSize: 16, fontWeight: 600, color: t.sub }}>XAF</span></div>
            <div style={{ height: 1, background: t.border, margin: "14px 40px" }} />
            <div style={{ fontSize: 12, color: t.sub }}>Client : <span style={{ fontWeight: 700, color: t.text }}>{d.client}</span></div>
          </div>
          <div style={{ padding: "12px 14px", borderRadius: 12, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>Preuves ({d.proofs})</span>
              {!isLocked && <button style={{ fontSize: 10, fontWeight: 700, color: GR, background: "none", border: "none", cursor: "pointer" }}>+ Ajouter</button>}
            </div>
            {d.proofs === 0 ? (
              <div style={{ padding: "14px", borderRadius: 8, textAlign: "center", border: `2px dashed ${G}25`, background: `${G}03` }}><div style={{ fontSize: 12, fontWeight: 700, color: G }}>Preuve manquante</div></div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>{Array.from({ length: d.proofs }).map((_, i) => (<div key={i} style={{ width: 70, height: 70, borderRadius: 8, background: "linear-gradient(135deg, #e8eef6, #f0ecf8)", border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: t.dim, position: "relative" }}>IMG{!isLocked && <div style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: RED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", cursor: "pointer" }}>×</div>}</div>))}</div>
            )}
          </div>
          <div style={{ padding: "10px 14px", borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8 }}>
            {[{ l: "Référence", v: d.ref }, { l: "Méthode", v: info?.short }, d.bank && { l: "Banque", v: d.bank }, { l: "Date", v: "13 mars 2026, 17:20" }].filter(Boolean).map((r, i, a) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < a.length - 1 ? `1px solid ${t.border}` : "none" }}><span style={{ fontSize: 11, color: t.sub }}>{r.l}</span><span style={{ fontSize: 11, fontWeight: 700 }}>{r.v}</span></div>
            ))}
          </div>
          {!isLocked && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {d.status === "proof_submitted" && <button style={{ width: "100%", padding: "13px", borderRadius: 10, background: V, border: "none", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Commencer la vérification</button>}
              <button style={{ width: "100%", padding: "13px", borderRadius: 10, background: GR, border: "none", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Valider le dépôt</button>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={{ flex: 1, padding: "11px", borderRadius: 10, background: "none", border: `1px solid ${RED}15`, fontSize: 12, fontWeight: 600, color: RED, cursor: "pointer" }}>Rejeter</button>
                <button style={{ flex: 1, padding: "11px", borderRadius: 10, background: "none", border: `1px solid ${O}20`, fontSize: 12, fontWeight: 600, color: O, cursor: "pointer" }}>Corriger</button>
              </div>
              <button style={{ width: "100%", padding: "11px", borderRadius: 10, background: "none", border: `1px solid ${t.border}`, fontSize: 11, fontWeight: 600, color: t.dim, cursor: "pointer" }}>Supprimer</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════ FORMULAIRE ═══════════════════════
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: t.bg, maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans',sans-serif", color: t.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ flexShrink: 0, background: t.card, borderBottom: `1px solid ${t.border}`, padding: "12px 20px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <span onClick={handleBack} style={{ fontSize: 20, color: t.sub, cursor: "pointer", marginRight: 12, fontWeight: 300 }}>‹</span>
          <span style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Nouveau dépôt</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: GR }}>{formStep}/{totalSteps}</span>
        </div>
        <div style={{ display: "flex", gap: 3 }}>{Array.from({ length: totalSteps }).map((_, i) => (<div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: formStep >= i + 1 ? GR : t.border }} />))}</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "20px 20px 0" }}>
        {/* 1 — Client */}
        {formStep === 1 && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Quel client ?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {CLIENTS.map(c => (<button key={c.id} onClick={() => setFormClient(c)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, width: "100%", background: formClient?.id === c.id ? `${GR}05` : t.card, border: `1.5px solid ${formClient?.id === c.id ? GR : t.border}`, cursor: "pointer", textAlign: "left" }}><div style={{ width: 38, height: 38, borderRadius: 10, background: `${V}08`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: V }}>{c.initials}</div><div><div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</div><div style={{ fontSize: 11, color: t.sub }}>{c.phone}</div></div>{formClient?.id === c.id && <span style={{ marginLeft: "auto", color: GR, fontSize: 16 }}>✓</span>}</button>))}
          </div>
        </div>)}
        {/* 2 — Montant */}
        {formStep === 2 && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Combien ?</div>
          <div style={{ padding: "24px 20px", borderRadius: 16, background: t.card, border: `1.5px solid ${t.border}`, textAlign: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8 }}>
              <input style={{ border: "none", background: "none", outline: "none", fontSize: 44, fontWeight: 900, color: t.text, fontFamily: "'DM Sans',sans-serif", width: "65%", textAlign: "right", letterSpacing: "-1.5px" }} placeholder="0" value={formAmount} onChange={e => setFormAmount(e.target.value.replace(/[^0-9]/g, ""))} type="tel" />
              <span style={{ fontSize: 20, fontWeight: 700, color: t.sub }}>XAF</span>
            </div>
            {formXAF > 0 && <div style={{ fontSize: 14, color: t.sub, marginTop: 6 }}>{fmt(formXAF)} XAF</div>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["100000", "500000", "1000000", "2000000"].map(v => (<button key={v} onClick={() => setFormAmount(v)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: formAmount === v ? `${GR}08` : t.card, border: `1px solid ${formAmount === v ? GR : t.border}`, fontSize: 12, fontWeight: 700, color: formAmount === v ? GR : t.text, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{parseInt(v) >= 1000000 ? `${parseInt(v)/1000000}M` : `${parseInt(v)/1000}K`}</button>))}
          </div>
        </div>)}
        {/* 3 — Famille */}
        {formStep === 3 && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Comment ?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(FAMILIES).map(([k, fam]) => (<button key={k} onClick={() => setFormFamily(k)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 14, width: "100%", background: formFamily === k ? `${fam.color}06` : t.card, border: `1.5px solid ${formFamily === k ? fam.color : t.border}`, cursor: "pointer", textAlign: "left" }}><div style={{ width: 44, height: 44, borderRadius: 12, background: fam.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: fam.dark ? "#1a1028" : "#fff", fontWeight: 800 }}>{fam.letter}</div><span style={{ fontSize: 16, fontWeight: 700 }}>{fam.name}</span>{formFamily === k && <span style={{ marginLeft: "auto", color: fam.color, fontSize: 16 }}>✓</span>}</button>))}
          </div>
        </div>)}
        {/* 4 — Sous-méthode ou Agence */}
        {formStep === 4 && formFamily === "BANK" && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Type d'opération</div>
          {[{ k: "BANK_TRANSFER", l: "Virement bancaire", d: "Depuis une app bancaire" }, { k: "BANK_CASH_DEPOSIT", l: "Dépôt cash au guichet", d: "En agence bancaire" }].map(m => (<button key={m.k} onClick={() => setFormSubmethod(m.k)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px", borderRadius: 12, width: "100%", marginBottom: 6, background: formSubmethod === m.k ? `${FAMILIES.BANK.color}06` : t.card, border: `1.5px solid ${formSubmethod === m.k ? FAMILIES.BANK.color : t.border}`, cursor: "pointer", textAlign: "left" }}><div><div style={{ fontSize: 14, fontWeight: 700 }}>{m.l}</div><div style={{ fontSize: 11, color: t.sub }}>{m.d}</div></div>{formSubmethod === m.k && <span style={{ marginLeft: "auto", color: FAMILIES.BANK.color, fontSize: 16 }}>✓</span>}</button>))}
        </div>)}
        {formStep === 4 && (formFamily === "ORANGE_MONEY" || formFamily === "MTN_MONEY") && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Type d'opération</div>
          {[{ k: "TRANSFER", l: `Transfert ${formFamily === "ORANGE_MONEY" ? "Orange" : "MTN"}`, d: "Depuis votre compte" }, { k: "WITHDRAWAL", l: "Code marchand", d: "Composez le code USSD" }].map(m => { const col = FAMILIES[formFamily].color; return (<button key={m.k} onClick={() => setFormSubmethod(m.k)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px", borderRadius: 12, width: "100%", marginBottom: 6, background: formSubmethod === m.k ? `${col}06` : t.card, border: `1.5px solid ${formSubmethod === m.k ? col : t.border}`, cursor: "pointer", textAlign: "left" }}><div><div style={{ fontSize: 14, fontWeight: 700 }}>{m.l}</div><div style={{ fontSize: 11, color: t.sub }}>{m.d}</div></div>{formSubmethod === m.k && <span style={{ marginLeft: "auto", color: col, fontSize: 16 }}>✓</span>}</button>); })}
        </div>)}
        {formStep === 4 && formFamily === "AGENCY_BONZINI" && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Quelle agence ?</div>
          {AGENCIES.map(a => (<button key={a.k} onClick={() => setFormAgency(a.k)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderRadius: 12, width: "100%", marginBottom: 6, background: formAgency === a.k ? `${V}06` : t.card, border: `1.5px solid ${formAgency === a.k ? V : t.border}`, cursor: "pointer", textAlign: "left" }}><div><div style={{ fontSize: 14, fontWeight: 700 }}>{a.l}</div><div style={{ fontSize: 11, color: t.sub }}>{a.addr} · {a.hours}</div></div>{formAgency === a.k && <span style={{ marginLeft: "auto", color: V, fontSize: 16 }}>✓</span>}</button>))}
        </div>)}
        {/* 5 — Banque */}
        {formStep === 5 && formFamily === "BANK" && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Quelle banque ?</div>
          {BANKS.map(b => (<button key={b.k} onClick={() => setFormBank(b.k)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px", borderRadius: 12, width: "100%", marginBottom: 6, background: formBank === b.k ? `${FAMILIES.BANK.color}06` : t.card, border: `1.5px solid ${formBank === b.k ? FAMILIES.BANK.color : t.border}`, cursor: "pointer", textAlign: "left" }}><span style={{ fontSize: 15, fontWeight: 700 }}>{b.l}</span>{formBank === b.k && <span style={{ marginLeft: "auto", color: FAMILIES.BANK.color, fontSize: 16 }}>✓</span>}</button>))}
        </div>)}
        {/* Récap */}
        {isRecap && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Tout est bon ?</div>
          <div style={{ padding: "20px", borderRadius: 14, textAlign: "center", background: t.card, border: `1.5px solid ${t.border}`, marginBottom: 8 }}>
            <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-1.5px" }}>{fmt(formXAF)} <span style={{ fontSize: 16, fontWeight: 600, color: t.sub }}>XAF</span></div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 14, background: t.card, border: `1.5px solid ${t.border}`, marginBottom: 8 }}>
            {[
              { l: "Client", v: formClient?.name },
              { l: "Méthode", v: FAMILIES[formFamily]?.name },
              formSubmethod && { l: "Type", v: formSubmethod === "BANK_TRANSFER" ? "Virement" : formSubmethod === "BANK_CASH_DEPOSIT" ? "Cash guichet" : formSubmethod === "TRANSFER" ? "Transfert" : "Code marchand" },
              selectedBankData && { l: "Banque", v: selectedBankData.l },
              selectedAgencyData && { l: "Agence", v: selectedAgencyData.l },
            ].filter(Boolean).map((r, i, a) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < a.length - 1 ? `1px solid ${t.border}` : "none" }}><span style={{ fontSize: 13, color: t.sub }}>{r.l}</span><span style={{ fontSize: 13, fontWeight: 700 }}>{r.v}</span></div>
            ))}
          </div>
          {/* Coordonnées de dépôt */}
          {selectedBankData && (
            <div style={{ padding: "14px 16px", borderRadius: 14, background: t.card, border: `1.5px solid ${t.border}`, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Coordonnées à communiquer</div>
              {[
                { l: "Titulaire", v: "BONZINI TRADING SARL" },
                { l: "N° Compte", v: selectedBankData.account },
                { l: "IBAN", v: selectedBankData.iban },
                { l: "SWIFT", v: selectedBankData.swift },
                { l: "Montant", v: `${fmt(formXAF)} XAF` },
              ].map((r, i, a) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < a.length - 1 ? `1px solid ${t.border}` : "none" }}>
                  <span style={{ fontSize: 11, color: t.sub }}>{r.l}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>{r.v}</span>
                    <CopyBtn text={r.v} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedAgencyData && (
            <div style={{ padding: "14px 16px", borderRadius: 14, background: t.card, border: `1.5px solid ${t.border}`, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Informations agence</div>
              {[{ l: "Agence", v: selectedAgencyData.l }, { l: "Adresse", v: selectedAgencyData.addr }, { l: "Horaires", v: selectedAgencyData.hours }].map((r, i, a) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: i < a.length - 1 ? `1px solid ${t.border}` : "none" }}><span style={{ fontSize: 11, color: t.sub }}>{r.l}</span><span style={{ fontSize: 11, fontWeight: 700 }}>{r.v}</span></div>
              ))}
            </div>
          )}
          {(formFamily === "ORANGE_MONEY" || formFamily === "MTN_MONEY") && (
            <div style={{ padding: "14px 16px", borderRadius: 14, background: t.card, border: `1.5px solid ${t.border}`, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Coordonnées {FAMILIES[formFamily].name}</div>
              {[
                { l: "Numéro", v: formFamily === "ORANGE_MONEY" ? "6 96 10 38 64" : "6 52 23 68 56" },
                { l: "Titulaire", v: formFamily === "ORANGE_MONEY" ? "WONDER PHONE" : "NGANGON SOH NELSON" },
                formSubmethod === "WITHDRAWAL" && { l: "Code marchand", v: formFamily === "ORANGE_MONEY" ? `#150*14*424393*696103864*${formXAF}#` : `*126*14*652236856*${formXAF}#` },
                { l: "Montant", v: `${fmt(formXAF)} XAF` },
              ].filter(Boolean).map((r, i, a) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < a.length - 1 ? `1px solid ${t.border}` : "none" }}>
                  <span style={{ fontSize: 11, color: t.sub }}>{r.l}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: r.l === "Code marchand" ? "monospace" : "inherit" }}>{r.v}</span>
                    <CopyBtn text={r.v} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {formFamily === "WAVE" && (
            <div style={{ padding: "14px 16px", borderRadius: 14, background: t.card, border: `1.5px solid ${t.border}`, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Coordonnées Wave</div>
              {[{ l: "Numéro", v: "+237 691 000 003" }, { l: "Titulaire", v: "BONZINI TRADING" }, { l: "Montant", v: `${fmt(formXAF)} XAF` }].map((r, i, a) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < a.length - 1 ? `1px solid ${t.border}` : "none" }}>
                  <span style={{ fontSize: 11, color: t.sub }}>{r.l}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 11, fontWeight: 700 }}>{r.v}</span><CopyBtn text={r.v} /></div>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: "10px 14px", borderRadius: 10, background: `${G}06`, border: `1px solid ${G}12`, fontSize: 12, color: t.sub, lineHeight: 1.5 }}>Le dépôt sera créé pour le client. Il pourra ensuite ajouter ses preuves.</div>
        </div>)}
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, padding: "10px 20px 18px", background: t.card, borderTop: `1px solid ${t.border}`, display: "flex", gap: 10 }}>
        {formStep > 1 && <button onClick={handleBack} style={{ flex: 1, padding: "15px 0", borderRadius: 12, background: "none", border: `1.5px solid ${t.border}`, fontSize: 14, fontWeight: 700, color: t.sub, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Retour</button>}
        <button onClick={() => isRecap ? setFormDone(true) : handleNext()} disabled={!canNext} style={{ flex: formStep === 1 ? 1 : 1.4, padding: "15px 0", borderRadius: 12, background: canNext ? GR : t.border, border: "none", fontSize: 14, fontWeight: 800, color: canNext ? "#fff" : t.dim, cursor: canNext ? "pointer" : "not-allowed", fontFamily: "'DM Sans',sans-serif" }}>{isRecap ? "Confirmer le dépôt" : "Suivant"}</button>
      </div>
    </div>
  );
}
