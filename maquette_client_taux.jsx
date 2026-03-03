import { useState, useEffect } from "react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, CartesianGrid } from "recharts";

const BASE_RATES = { cash: 11800, alipay: 11650, wechat: 11700, virement: 11750 };
const COUNTRY_ADJ = {
  cameroun: 0, gabon: -1.5, tchad: -1.5, rca: -1.5, congo: -1.5, guinee: -1.5,
};
const TIER_ADJ = { t3: 0, t2: -1, t1: -2 };

const PAYMENT_METHODS = [
  { key: "cash", label: "Cash", icon: "💵", color: "#10b981" },
  { key: "alipay", label: "Alipay", icon: "🔵", color: "#3b82f6" },
  { key: "wechat", label: "WeChat", icon: "🟢", color: "#07c160" },
  { key: "virement", label: "Virement", icon: "🏦", color: "#8b5cf6" },
];

const COUNTRIES = [
  { key: "cameroun", label: "Cameroun", flag: "🇨🇲" },
  { key: "gabon", label: "Gabon", flag: "🇬🇦" },
  { key: "tchad", label: "Tchad", flag: "🇹🇩" },
  { key: "rca", label: "Centrafrique", flag: "🇨🇫" },
  { key: "congo", label: "Congo", flag: "🇨🇬" },
  { key: "guinee", label: "Guinée Éq.", flag: "🇬🇶" },
];

const CHART_DATA = [
  { date: "11/02", rate: 11500 }, { date: "13/02", rate: 11480 },
  { date: "15/02", rate: 11550 }, { date: "17/02", rate: 11580 },
  { date: "19/02", rate: 11610 }, { date: "20/02", rate: 11650 },
  { date: "21/02", rate: 11670 }, { date: "22/02", rate: 11680 },
  { date: "23/02", rate: 11610 }, { date: "24/02", rate: 11680 },
  { date: "25/02", rate: 11700 }, { date: "26/02", rate: 11705 },
  { date: "27/02", rate: 11750 }, { date: "01/03", rate: 11780 },
  { date: "02/03", rate: 11800 },
];
const CHART_7D = CHART_DATA.slice(-7);
const CHART_3M = [
  { date: "Déc", rate: 11200 }, { date: "Mi-Déc", rate: 11280 },
  { date: "Jan", rate: 11350 }, { date: "Mi-Jan", rate: 11400 },
  { date: "Fév", rate: 11500 }, { date: "Mi-Fév", rate: 11600 },
  { date: "Mars", rate: 11800 },
];
const CHART_1A = [
  { date: "Avr 25", rate: 10200 }, { date: "Juin", rate: 10500 },
  { date: "Août", rate: 10800 }, { date: "Oct", rate: 11000 },
  { date: "Déc", rate: 11200 }, { date: "Fév 26", rate: 11500 },
  { date: "Mars", rate: 11800 },
];

function getTier(amount) {
  if (amount >= 1000000) return "t3";
  if (amount >= 400000) return "t2";
  return "t1";
}

function calcRate(method, amount, country) {
  const base = BASE_RATES[method];
  const cAdj = COUNTRY_ADJ[country] / 100;
  const tAdj = TIER_ADJ[getTier(amount)] / 100;
  return base * (1 + cAdj) * (1 + tAdj);
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.[0]) return null;
  return (
    <div style={{ background: "rgba(26,26,46,0.95)", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#a78bfa" }}>{payload[0].value.toLocaleString("fr-FR")} ¥</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>pour 1 000 000 XAF</div>
    </div>
  );
};

export default function ClientApp() {
  const [selectedMethod, setSelectedMethod] = useState("cash");
  const [selectedCountry, setSelectedCountry] = useState("cameroun");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [direction, setDirection] = useState("xaf");
  const [amount, setAmount] = useState("1000000");
  const [chartPeriod, setChartPeriod] = useState("30J");
  const [animatedResult, setAnimatedResult] = useState(0);

  const numAmount = parseFloat(amount) || 0;
  const finalRate = calcRate(selectedMethod, numAmount, selectedCountry);
  const result = numAmount * (finalRate / 1000000);
  const refRate = calcRate(selectedMethod, 1000000, selectedCountry);

  const currentPm = PAYMENT_METHODS.find(p => p.key === selectedMethod);
  const currentCountry = COUNTRIES.find(c => c.key === selectedCountry);

  useEffect(() => {
    const target = result;
    const start = animatedResult;
    const diff = target - start;
    if (Math.abs(diff) < 1) { setAnimatedResult(target); return; }
    const duration = 300;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedResult(start + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [result]);

  const chartData = chartPeriod === "7J" ? CHART_7D : chartPeriod === "3M" ? CHART_3M : chartPeriod === "1A" ? CHART_1A : CHART_DATA;
  const chartVals = chartData.map(d => d.rate);
  const stats = { min: Math.min(...chartVals), max: Math.max(...chartVals), avg: Math.round(chartVals.reduce((a, b) => a + b, 0) / chartVals.length) };

  const quickAmounts = ["100000", "250000", "500000", "1000000", "2000000"];

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#f8f9fb", fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", position: "relative" }}>

      {/* Status bar */}
      <div style={{ padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600, color: "#1a1a2e", background: "#fff" }}>
        <span>00:19</span><span style={{ fontSize: 11, color: "#999" }}>bonzinilabs.com</span><span>5G 🔋</span>
      </div>

      {/* Header */}
      <div style={{ background: "#fff", padding: "10px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #f97316, #ef4444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#1a1a2e", letterSpacing: -0.5 }}>BONZINI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#999", fontSize: 14 }}>🔔 <span style={{ fontSize: 13, fontWeight: 600 }}>0</span></div>
      </div>

      {/* Page title */}
      <div style={{ background: "#fff", padding: "10px 20px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18, color: "#666", cursor: "pointer" }}>←</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>Taux de change</span>
      </div>

      <div style={{ padding: "0 16px 100px" }}>

        {/* ===== RATE HERO CARD ===== */}
        <div style={{
          background: "linear-gradient(135deg, #fefce8, #fef9c3)",
          borderRadius: 16, padding: "18px 20px", marginBottom: 12, border: "1px solid #fde68a",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "#92400e", fontWeight: 500 }}>XAF → CNY</span>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12 }}>{currentCountry.flag}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e" }}>{currentCountry.label}</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12 }}>{currentPm.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e" }}>{currentPm.label}</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: "#1a1a2e", marginBottom: 4 }}>
            1 000 000 XAF = {Math.round(refRate).toLocaleString("fr-FR")}
          </div>
          <div style={{ fontSize: 13, color: "#78716c" }}>CNY</div>
          <div style={{ fontSize: 12, color: "#a8a29e", marginTop: 2 }}>1 CNY = {Math.round(1000000 / refRate).toLocaleString("fr-FR")} XAF</div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <span style={{ fontSize: 11, color: "#a8a29e" }}>Il y a 17h</span>
            <div style={{ background: "#dcfce7", borderRadius: 8, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12 }}>📈</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>+0,4%</span>
              <span style={{ fontSize: 10, color: "#4ade80" }}>(30j)</span>
            </div>
          </div>
        </div>

        {/* ===== COUNTRY SELECTOR ===== */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: 12, color: "#999", fontWeight: 500, marginBottom: 8 }}>Votre pays</div>

          {/* Dropdown trigger */}
          <button
            onClick={() => setShowCountryPicker(!showCountryPicker)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: showCountryPicker ? "2px solid #7c3aed" : "2px solid #f0f0f0",
              background: showCountryPicker ? "#f9f5ff" : "#fafafa",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{currentCountry.flag}</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>{currentCountry.label}</div>
                {COUNTRY_ADJ[selectedCountry] !== 0 && (
                  <div style={{ fontSize: 11, color: "#999" }}>Taux ajusté zone CEMAC</div>
                )}
              </div>
            </div>
            <span style={{
              fontSize: 14, color: "#999",
              transform: showCountryPicker ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}>▼</span>
          </button>

          {/* Dropdown list */}
          {showCountryPicker && (
            <div style={{
              marginTop: 8, borderRadius: 12, overflow: "hidden",
              border: "1px solid #f0f0f0",
            }}>
              {COUNTRIES.map((c, i) => {
                const isSelected = selectedCountry === c.key;
                const cRate = Math.round(calcRate(selectedMethod, 1000000, c.key));
                return (
                  <button
                    key={c.key}
                    onClick={() => { setSelectedCountry(c.key); setShowCountryPicker(false); }}
                    style={{
                      width: "100%", padding: "12px 14px",
                      background: isSelected ? "#f3e8ff" : i % 2 === 0 ? "#fafafa" : "#fff",
                      border: "none", borderBottom: i < COUNTRIES.length - 1 ? "1px solid #f5f5f5" : "none",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{c.flag}</span>
                      <span style={{ fontSize: 14, fontWeight: isSelected ? 700 : 500, color: isSelected ? "#7c3aed" : "#1a1a2e" }}>{c.label}</span>
                      {isSelected && <span style={{ fontSize: 14, color: "#7c3aed" }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#888" }}>{cRate.toLocaleString("fr-FR")} ¥</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== PAYMENT METHOD SELECTOR ===== */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: 12, color: "#999", fontWeight: 500, marginBottom: 8 }}>Mode de paiement</div>
          <div style={{ display: "flex", gap: 6 }}>
            {PAYMENT_METHODS.map(pm => {
              const isActive = selectedMethod === pm.key;
              const pmRate = Math.round(calcRate(pm.key, 1000000, selectedCountry));
              return (
                <button key={pm.key} onClick={() => setSelectedMethod(pm.key)} style={{
                  flex: 1, padding: "10px 4px", borderRadius: 12,
                  border: isActive ? `2px solid ${pm.color}` : "2px solid #f0f0f0",
                  background: isActive ? `${pm.color}08` : "#fafafa",
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4, transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: 18 }}>{pm.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? pm.color : "#aaa" }}>{pm.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? "#1a1a2e" : "#ccc" }}>{pmRate.toLocaleString("fr-FR")}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== CONVERTER ===== */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "16px 20px", marginBottom: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, marginBottom: 16 }}>
            {[{ key: "xaf", label: "Par XAF" }, { key: "cny", label: "Par CNY" }].map(d => (
              <button key={d.key} onClick={() => setDirection(d.key)} style={{
                flex: 1, padding: 10, borderRadius: 8, border: "none",
                background: direction === d.key ? "#fff" : "transparent",
                color: direction === d.key ? "#1a1a2e" : "#999",
                fontWeight: direction === d.key ? 600 : 400, fontSize: 14, cursor: "pointer",
                boxShadow: direction === d.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}>{d.label}</button>
            ))}
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Vous envoyez</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <input type="text" value={numAmount.toLocaleString("fr-FR")}
                onChange={e => { const val = e.target.value.replace(/\s/g, "").replace(/\./g, ""); if (/^\d*$/.test(val)) setAmount(val); }}
                style={{ fontSize: 28, fontWeight: 800, color: "#1a1a2e", border: "none", outline: "none", background: "transparent", width: "70%", fontFamily: "inherit" }}
              />
              <span style={{ fontSize: 16, fontWeight: 600, color: "#aaa" }}>XAF</span>
            </div>
            <div style={{ height: 1, background: "#e5e7eb", marginTop: 8 }} />
          </div>

          <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f3f0ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#7c3aed", border: "2px solid #ede9fe" }}>⇅</div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Vous recevez</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed" }}>
                {animatedResult.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: 16, fontWeight: 600, color: "#aaa" }}>CNY</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {quickAmounts.map(v => {
              const isActive = amount === v;
              const label = parseInt(v) >= 1000000 ? `${parseInt(v)/1000000},0M` : `${parseInt(v)/1000}K`;
              return (
                <button key={v} onClick={() => setAmount(v)} style={{
                  flex: 1, padding: "10px 4px", borderRadius: 10,
                  border: isActive ? "2px solid #7c3aed" : "1.5px solid #e5e7eb",
                  background: isActive ? "#f3e8ff" : "#fff",
                  color: isActive ? "#7c3aed" : "#888", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>{label}</button>
              );
            })}
          </div>

          <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "#c4b5fd", fontStyle: "italic" }}>
            Taux appliqué au moment du paiement
          </div>
        </div>

        {/* ===== RATE DETAIL ===== */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "12px 16px", marginBottom: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>Taux appliqué à votre montant</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>
                1M XAF = {Math.round(finalRate).toLocaleString("fr-FR")} CNY
              </span>
            </div>
          </div>
          <div style={{
            background: numAmount >= 1000000 ? "#dcfce7" : numAmount >= 400000 ? "#fef3c7" : "#fee2e2",
            borderRadius: 8, padding: "6px 10px",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600,
              color: numAmount >= 1000000 ? "#16a34a" : numAmount >= 400000 ? "#d97706" : "#dc2626",
            }}>
              {numAmount >= 1000000 ? "✦ Meilleur taux" : numAmount >= 400000 ? "Taux standard" : "Petit montant"}
            </div>
          </div>
        </div>

        {/* ===== CHART ===== */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "16px 8px 12px", marginBottom: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ padding: "0 8px", marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>Tendance du taux</div>
          </div>
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, margin: "0 8px 14px" }}>
            {["7J", "30J", "3M", "1A"].map(p => (
              <button key={p} onClick={() => setChartPeriod(p)} style={{
                flex: 1, padding: "8px 6px", borderRadius: 8, border: "none",
                background: chartPeriod === p ? "#fff" : "transparent",
                color: chartPeriod === p ? "#1a1a2e" : "#999",
                fontWeight: chartPeriod === p ? 600 : 400, fontSize: 13, cursor: "pointer",
                boxShadow: chartPeriod === p ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}>{p}</button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#ccc" }} axisLine={{ stroke: "#f0f0f0" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#ccc" }} axisLine={false} tickLine={false} domain={["dataMin - 50", "dataMax + 50"]} tickFormatter={v => v.toLocaleString("fr-FR")} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="rate" stroke="#7c3aed" strokeWidth={2.5} fill="url(#rateGrad)"
                dot={{ r: 3, fill: "#7c3aed", strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff", fill: "#7c3aed" }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "space-around", padding: "10px 8px 4px" }}>
            {[
              { label: "Min", value: stats.min, color: "#ef4444" },
              { label: "Moy", value: stats.avg, color: "#1a1a2e" },
              { label: "Max", value: stats.max, color: "#16a34a" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <span style={{ fontSize: 12, color: "#aaa" }}>{s.label}: </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value.toLocaleString("fr-FR")} ¥</span>
              </div>
            ))}
          </div>
        </div>

        {/* ===== BANNER ===== */}
        <div style={{
          background: "linear-gradient(135deg, #f3e8ff, #ede9fe)",
          borderRadius: 14, padding: "14px 18px",
          display: "flex", alignItems: "center", gap: 12, border: "1px solid #ddd6fe",
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(124,58,237,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📊</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e", marginBottom: 2 }}>Suivez les taux en temps réel</div>
            <div style={{ fontSize: 12, color: "#78716c", lineHeight: 1.4 }}>Les taux sont mis à jour chaque matin pour vous offrir le meilleur cours.</div>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430, background: "#fff", borderTop: "1px solid #f0f0f0",
        display: "flex", justifyContent: "space-around", padding: "10px 0 22px",
      }}>
        {[
          { icon: "💳", label: "Wallet" },
          { icon: "📥", label: "Dépôts" },
          { icon: "📤", label: "Paiements", active: true },
          { icon: "🕐", label: "Historique" },
          { icon: "👤", label: "Profil" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 400, color: item.active ? "#7c3aed" : "#aaa" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
