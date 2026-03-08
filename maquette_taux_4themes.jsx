import { useState } from "react";

const RATES = [
  { icon: "支", label: "Alipay", color: "#1677ff", rate: 11610 },
  { icon: "微", label: "WeChat", color: "#07c160", rate: 11610 },
  { icon: "🏦", label: "Virement", color: "#8b5cf6", rate: 11610 },
  { icon: "¥", label: "Cash", color: "#dc2626", rate: 11575 },
];

function fmt(n) { return n.toLocaleString("fr-FR"); }

// ─── COMPOSANT UNIQUE AVEC PROP theme ───
function RateCard({ theme = "dark" }) {
  const isDark = theme === "dark";
  const colors = {
    bg: isDark ? "#13152a" : "#ffffff",
    border: isDark ? "rgba(124,58,237,0.12)" : "#eee",
    shadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.03)",
    titleColor: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af",
    mainText: isDark ? "#fff" : "#1a1a2e",
    equalSign: isDark ? "rgba(255,255,255,0.25)" : "#d1d5db",
    btnBg: isDark ? "rgba(124,58,237,0.1)" : "#f3f0ff",
    cellBg: isDark ? "rgba(255,255,255,0.03)" : "#f9f9fb",
    labelColor: isDark ? "rgba(255,255,255,0.35)" : "#9ca3af",
    footerBorder: isDark ? "rgba(255,255,255,0.04)" : "#f3f3f3",
    footerText: isDark ? "rgba(255,255,255,0.2)" : "#c4c7ce",
  };

  return (
    <div style={{
      background: colors.bg, borderRadius: 14, padding: "12px 14px",
      border: `1px solid ${colors.border}`,
      boxShadow: colors.shadow,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: colors.titleColor, textTransform: "uppercase", letterSpacing: 1.2 }}>Taux du jour</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: colors.mainText, marginTop: 2 }}>1 000 000 XAF <span style={{ color: colors.equalSign, fontWeight: 500 }}>=</span></div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: "#7c3aed", cursor: "pointer",
          padding: "5px 10px", borderRadius: 7, background: colors.btnBg,
        }}>Détails →</div>
      </div>

      {/* Grid 2×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {RATES.map(r => (
          <div key={r.label} style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 10px", borderRadius: 10,
            background: colors.cellBg,
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 6,
              background: `${r.color}${isDark ? "15" : "10"}`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, color: r.color, fontWeight: 700, flexShrink: 0,
            }}>{r.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: colors.labelColor, lineHeight: 1 }}>{r.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: colors.mainText, letterSpacing: "-0.3px", lineHeight: 1.2, marginTop: 1 }}>¥{fmt(r.rate)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 8, paddingTop: 8,
        borderTop: `1px solid ${colors.footerBorder}`,
        fontSize: 10, color: colors.footerText, fontWeight: 500,
      }}>
        Mis à jour aujourd'hui à 09:00
      </div>
    </div>
  );
}

// ─── SHOWCASE 4 VARIANTES ───
export default function App() {
  const [tab, setTab] = useState("all");

  const variants = [
    { key: "admin-dark", label: "Admin · Dark", theme: "dark", containerBg: "#0c0e18" },
    { key: "admin-light", label: "Admin · Light", theme: "light", containerBg: "#f5f5f7" },
    { key: "client-dark", label: "Client · Dark", theme: "dark", containerBg: "#0c0e18" },
    { key: "client-light", label: "Client · Light", theme: "light", containerBg: "#f5f5f7" },
  ];

  const filtered = tab === "all" ? variants
    : tab === "dark" ? variants.filter(v => v.theme === "dark")
    : variants.filter(v => v.theme === "light");

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0b14",
      fontFamily: "'DM Sans', sans-serif", padding: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, maxWidth: 390, margin: "0 auto 20px",
        background: "#13152a", borderRadius: 10, padding: 3,
      }}>
        {[
          { key: "all", label: "4 variantes" },
          { key: "dark", label: "Dark" },
          { key: "light", label: "Light" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "8px", borderRadius: 8, border: "none",
            background: tab === t.key ? "#7c3aed" : "transparent",
            color: tab === t.key ? "#fff" : "rgba(255,255,255,0.35)",
            fontWeight: 700, fontSize: 11, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Cards */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
        maxWidth: 390, margin: "0 auto",
      }}>
        {filtered.map(v => (
          <div key={v.key} style={{ width: "100%" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.2)",
              textTransform: "uppercase", letterSpacing: 2, marginBottom: 8, textAlign: "center",
            }}>{v.label}</div>
            <div style={{ background: v.containerBg, borderRadius: 18, padding: 14 }}>
              <RateCard theme={v.theme} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
