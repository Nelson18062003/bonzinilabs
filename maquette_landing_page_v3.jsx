import { useState, useEffect, useRef } from "react";

// ============================================================
// BONZINI — LANDING PAGE V3
// Aesthetic: Bold editorial × kinetic fintech
// Fonts: Syne (display) + Satoshi/DM Sans (body)
// Instant payments, no 24h delay
// ============================================================

function useInView(t = 0.1) {
  const r = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = r.current; if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: t });
    o.observe(el); return () => o.disconnect();
  }, [t]);
  return [r, v];
}

function Reveal({ children, delay = 0, y = 50 }) {
  const [r, v] = useInView();
  return <div ref={r} style={{
    opacity: v ? 1 : 0, transform: v ? "none" : `translateY(${y}px)`,
    transition: `all 1s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  }}>{children}</div>;
}

// Animated counter
function Counter({ end, duration = 2, suffix = "", prefix = "" }) {
  const [val, setVal] = useState(0);
  const [ref, inView] = useInView();
  useEffect(() => {
    if (!inView) return;
    let start = 0; const step = end / (duration * 60);
    const id = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(id);
  }, [inView, end, duration]);
  return <span ref={ref}>{prefix}{val.toLocaleString("fr-FR")}{suffix}</span>;
}

const C = {
  bg: "#050208", violet: "#a64af7", violetGlow: "#c084fc",
  gold: "#f3a745", orange: "#fe560d",
  text: "#ffffff", muted: "#8b82a0", dim: "#3d3555",
  surface: "#0f0b18", surfaceLight: "#1a1428",
  alipay: "#1677ff", wechat: "#07c160",
};

const F = { display: "'Syne', sans-serif", body: "'DM Sans', sans-serif" };

// ─── LOGO ───
function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M50.8,43.87L49.79,43.9L48.86,43.85L47.93,43.7L47.15,43.52L46.4,43.24L45.69,42.93L45.05,42.56L44.45,42.12L43.91,41.66L43.44,41.12L43.01,40.56L42.57,39.97L42.12,39.37L41.69,38.78L41.25,38.19L40.81,37.6L40.39,37.0L39.97,36.45L39.54,35.85L39.12,35.27L38.7,34.7L38.27,34.12L37.85,33.53L37.41,32.94L36.98,32.35L36.55,31.75L36.13,31.16L35.68,30.57L35.27,29.97L34.82,29.38L34.42,28.79L33.97,28.2L33.55,27.6L33.11,27.02L32.68,26.43L32.29,25.83L32.47,25.15L33.02,24.72L33.67,24.3L34.29,23.88L34.89,23.53L35.56,23.15L36.24,22.79L36.92,22.45L37.6,22.12L38.27,21.84L39.03,21.54L39.8,21.27L40.56,21.02L41.32,20.8L42.13,20.58L42.93,20.39L43.86,20.25L44.25,20.91L44.44,21.76L44.61,22.61L44.78,23.45L44.96,24.29L45.12,25.15L45.29,25.99L45.46,26.84L45.63,27.69L45.81,28.52L45.97,29.38L46.15,30.23L46.32,31.06L46.49,31.91L46.66,32.75L46.82,33.6L46.99,34.44L47.17,35.22L47.34,36.07L47.51,36.92L47.67,37.76L47.81,38.7L48.05,39.46L48.52,39.99L49.27,40.3L50.21,40.34L51.06,40.18L51.64,39.71L51.97,39.03L52.16,38.26L52.33,37.41L52.5,36.49L52.67,35.65L52.83,34.8L52.99,33.95L53.17,33.11L53.34,32.26L53.49,31.41L53.66,30.57L53.83,29.72L54.01,28.87L54.18,28.03L54.34,27.18L54.52,26.33L54.69,25.49L54.86,24.64L55.03,23.79L55.2,22.95L55.38,22.18L55.57,21.34L55.8,20.5L56.14,19.85L56.96,20.07L57.66,20.38L58.34,20.67L59.1,20.99L59.78,21.3L60.47,21.59L61.21,21.93L61.9,22.22L62.59,22.52L63.34,22.85L64.01,23.15L64.73,23.45L65.45,23.77L66.13,24.06L66.86,24.39L67.56,24.72L67.67,25.4L67.36,26.08L66.98,26.74L66.55,27.34L66.13,27.92L65.71,28.49L65.28,29.09L64.86,29.68L64.44,30.24L64.0,30.82L63.59,31.42L63.16,32.01L62.73,32.6L62.31,33.19L61.87,33.78L61.44,34.38L61.01,34.97L60.58,35.56L60.14,36.16L59.71,36.75L59.27,37.33L58.85,37.91L58.43,38.48L58.0,39.06L57.58,39.66L57.14,40.22L56.71,40.81L56.22,41.4L55.72,41.91L55.18,42.34L54.53,42.74L53.86,43.1L53.18,43.37L52.41,43.61L51.57,43.79Z" fill="#F3A745"/>
      <path d="M51.4,49.03L50.21,49.07L49.03,49.07L47.84,49.07L46.74,48.97L45.64,48.9L44.54,48.82L43.44,48.72L42.42,48.57L41.41,48.41L40.39,48.24L39.33,48.09L38.36,47.91L37.34,47.75L36.33,47.57L35.31,47.4L34.29,47.21L33.28,47.02L32.26,46.83L31.33,46.65L30.31,46.46L29.3,46.25L28.35,46.06L27.35,45.87L26.33,45.69L25.32,45.5L24.3,45.32L23.29,45.13L22.35,44.96L21.34,44.76L20.49,44.45L19.98,43.73L20.15,42.77L20.46,41.91L20.78,41.07L21.09,40.22L21.43,39.37L21.76,38.49L22.1,37.62L22.43,36.75L22.75,35.9L23.09,35.06L23.4,34.21L23.74,33.36L24.44,33.11L25.19,33.53L25.91,33.97L26.67,34.45L27.35,34.9L28.09,35.39L28.79,35.86L29.49,36.33L30.23,36.83L30.91,37.27L31.65,37.76L32.35,38.23L33.06,38.7L33.78,39.19L34.46,39.64L35.19,40.14L35.9,40.6L36.6,41.07L37.34,41.56L38.02,42.02L38.77,42.51L39.46,42.96L40.22,43.43L40.98,43.82L41.78,44.2L42.59,44.55L43.45,44.88L44.37,45.16L45.3,45.4L46.32,45.61L47.33,45.78L48.43,45.85L49.53,45.93L50.64,45.87L51.82,45.81L52.84,45.65L53.79,45.47L54.78,45.22L55.63,44.96L56.56,44.63L57.39,44.28L58.17,43.94L58.93,43.51L59.7,43.07L60.44,42.59L61.13,42.13L61.84,41.66L62.57,41.17L63.26,40.73L64.01,40.23L64.69,39.75L65.39,39.29L66.13,38.8L66.81,38.35L67.57,37.87L68.25,37.4L68.95,36.92L69.69,36.42L70.36,35.99L71.13,35.48L71.8,35.05L72.51,34.55L73.24,34.08L73.96,33.62L74.68,33.17L75.44,33.21L75.81,34.04L76.14,34.89L76.49,35.73L76.84,36.58L77.18,37.43L77.52,38.27L77.86,39.12L78.2,39.97L78.54,40.81L78.89,41.66L79.23,42.51L79.57,43.35L79.75,44.2L78.91,44.54L77.9,44.75L76.88,44.94L75.87,45.12L74.94,45.3L73.92,45.48L72.9,45.67L71.89,45.85L70.87,46.06L69.93,46.23L68.92,46.41L67.91,46.64L66.98,46.83L65.96,47.04L64.94,47.22L64.01,47.44L63.0,47.64L61.98,47.81L60.97,48.0L59.95,48.16L58.93,48.3L57.88,48.43L56.82,48.56L55.8,48.71L54.7,48.79L53.6,48.9L52.41,48.93L51.4,49.03Z" fill="#A947FE"/>
      <path d="M75.61,66.81L74.77,66.56L74.12,66.13L73.47,65.71L72.8,65.28L72.14,64.83L71.46,64.42L70.79,63.97L70.11,63.53L69.43,63.09L68.76,62.67L68.1,62.24L67.44,61.81L66.79,61.39L66.13,60.93L65.45,60.49L64.8,60.03L64.18,59.6L63.51,59.13L62.88,58.68L62.24,58.2L61.63,57.75L60.97,57.26L60.32,56.82L59.64,56.39L58.93,56.02L58.17,55.63L57.45,55.29L56.65,55.0L55.8,54.74L54.95,54.51L54.02,54.3L53.09,54.15L52.16,54.02L51.06,53.98L49.96,53.98L48.86,53.99L47.87,54.11L46.91,54.21L45.98,54.39L45.05,54.61L44.2,54.85L43.43,55.12L42.61,55.46L41.83,55.8L41.15,56.15L40.4,56.56L39.71,56.96L39.03,57.39L38.36,57.83L37.68,58.25L37.02,58.68L36.36,59.1L35.7,59.53L35.05,59.95L34.38,60.4L33.7,60.85L33.02,61.29L32.39,61.73L31.75,62.16L31.08,62.6L30.4,63.06L29.76,63.51L29.12,63.93L28.45,64.39L27.77,64.85L27.1,65.28L26.49,65.71L25.83,66.16L25.15,66.59L24.39,66.76L24.01,66.05L23.7,65.28L23.37,64.5L23.03,63.7L22.71,62.91L22.4,62.15L22.09,61.39L21.75,60.63L21.42,59.84L21.11,59.02L20.77,58.26L20.45,57.49L20.14,56.73L20.24,55.9L21.08,55.64L21.91,55.38L22.72,55.12L23.6,54.87L24.47,54.65L25.32,54.4L26.16,54.19L27.1,53.96L27.94,53.75L28.87,53.53L29.75,53.34L30.65,53.16L31.58,52.97L32.51,52.79L33.45,52.63L34.38,52.46L35.31,52.3L36.3,52.16L37.26,52.01L38.27,51.92L39.2,51.78L40.22,51.66L41.24,51.59L42.17,51.46L43.27,51.41L44.28,51.33L45.3,51.27L46.4,51.24L47.42,51.19L48.52,51.18L49.53,51.1L50.64,51.1L51.65,51.18L52.75,51.2L53.77,51.25L54.87,51.27L55.88,51.34L56.9,51.43L57.94,51.48L58.93,51.59L59.95,51.68L60.97,51.79L61.9,51.92L62.91,52.05L63.84,52.18L64.78,52.33L65.79,52.49L66.72,52.65L67.65,52.83L68.59,53.0L69.46,53.18L70.36,53.4L71.3,53.57L72.14,53.78L73.07,54.02L73.92,54.21L74.8,54.45L75.7,54.69L76.55,54.91L77.39,55.17L78.24,55.43L79.09,55.69L79.85,56.01L79.73,56.9L79.4,57.66L79.09,58.48L78.76,59.27L78.44,60.03L78.15,60.8L77.82,61.62L77.49,62.4L77.16,63.17L76.85,63.93L76.55,64.74L76.21,65.54L75.9,66.3Z" fill="#A947FE"/>
      <path d="M56.31,80.04L55.73,79.59L55.55,78.76L55.38,77.93L55.21,77.1L55.04,76.29L54.87,75.44L54.69,74.6L54.52,73.75L54.34,72.9L54.17,72.06L54.0,71.21L53.82,70.36L53.65,69.52L53.48,68.67L53.3,67.82L53.13,66.98L52.96,66.13L52.79,65.28L52.61,64.44L52.43,63.59L52.26,62.74L52.12,61.9L51.96,61.05L51.68,60.29L51.21,59.78L50.47,59.51L49.45,59.48L48.66,59.7L48.11,60.2L47.8,60.88L47.63,61.73L47.47,62.57L47.3,63.42L47.15,64.27L46.98,65.11L46.8,65.96L46.64,66.81L46.47,67.65L46.3,68.5L46.14,69.35L45.96,70.19L45.79,71.04L45.62,71.89L45.44,72.73L45.27,73.58L45.11,74.43L44.93,75.28L44.76,76.12L44.59,76.97L44.4,77.82L44.2,78.63L43.95,79.38L43.16,79.51L42.34,79.31L41.49,79.1L40.73,78.89L39.97,78.65L39.2,78.38L38.44,78.09L37.76,77.8L37.06,77.48L36.37,77.14L35.7,76.8L35.06,76.44L34.38,76.04L33.78,75.67L33.18,75.28L32.58,74.85L32.1,74.26L32.5,73.58L32.91,72.99L33.35,72.4L33.78,71.8L34.21,71.22L34.63,70.64L35.06,70.04L35.48,69.46L35.9,68.9L36.33,68.29L36.75,67.73L37.18,67.15L37.63,66.55L38.08,65.96L38.52,65.37L38.95,64.81L39.37,64.23L39.8,63.66L40.22,63.08L40.66,62.49L41.07,61.88L41.49,61.24L41.9,60.63L42.27,60.03L42.69,59.44L43.17,58.85L43.65,58.34L44.2,57.83L44.79,57.43L45.39,57.07L46.15,56.74L46.91,56.48L47.68,56.31L48.6,56.18L49.53,56.1L50.47,56.16L51.48,56.22L52.33,56.35L53.17,56.56L53.85,56.83L54.56,57.15L55.19,57.58L55.72,58.01L56.23,58.51L56.73,59.1L57.15,59.68L57.58,60.27L57.99,60.88L58.41,61.47L58.83,62.07L59.25,62.66L59.68,63.25L60.11,63.84L60.54,64.43L60.96,65.03L61.39,65.6L61.81,66.17L62.24,66.75L62.66,67.33L63.09,67.91L63.52,68.5L63.96,69.09L64.41,69.69L64.84,70.28L65.28,70.87L65.71,71.45L66.13,72.03L66.55,72.63L66.97,73.24L67.34,73.84L67.74,74.49L67.43,75.11L66.72,75.42L66.05,75.72L65.35,76.04L64.61,76.36L63.93,76.65L63.25,76.97L62.5,77.31L61.81,77.62L61.13,77.92L60.41,78.24L59.7,78.54L59.02,78.85L58.29,79.17L57.58,79.49L56.9,79.79Z" fill="#FE560D"/>
    </svg>
  );
}

// ─── NAVBAR ───
function Nav() {
  const [s, setS] = useState(false);
  useEffect(() => { const h = () => setS(window.scrollY > 50); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: s ? "rgba(5,2,8,0.85)" : "transparent",
      backdropFilter: s ? "blur(20px) saturate(180%)" : "none",
      borderBottom: s ? "1px solid rgba(169,71,254,0.1)" : "none",
      transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={28} />
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 20, color: "#fff", letterSpacing: "-0.5px" }}>Bonzini</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {["Fonctionnement", "Tarifs", "FAQ"].map(t => (
            <a key={t} href="#" style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.muted, textDecoration: "none" }}>{t}</a>
          ))}
          <button style={{
            fontFamily: F.body, fontWeight: 700, fontSize: 13, color: "#fff",
            background: `linear-gradient(135deg, ${C.violet}, #8b3cf0)`,
            border: "none", padding: "10px 22px", borderRadius: 50, cursor: "pointer",
          }}>Envoyer un paiement</button>
        </div>
      </div>
    </nav>
  );
}

// ─── HERO ───
function Hero() {
  const [ok, setOk] = useState(false);
  const [xaf, setXaf] = useState("500 000");
  useEffect(() => { setTimeout(() => setOk(true), 200); }, []);

  return (
    <section style={{
      minHeight: "100vh", background: C.bg, position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", padding: "100px 24px 60px",
    }}>
      {/* Animated gradient mesh */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "80%",
          borderRadius: "50%", filter: "blur(150px)", opacity: 0.2,
          background: `conic-gradient(from 180deg, ${C.violet}, ${C.gold}, ${C.orange}, ${C.violet})`,
          animation: "spin 20s linear infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-30%", right: "-15%", width: "50%", height: "70%",
          borderRadius: "50%", filter: "blur(140px)", opacity: 0.12,
          background: `radial-gradient(circle, ${C.gold}, transparent)`,
          animation: "pulse 6s ease-in-out infinite",
        }} />
        {/* Noise texture */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", position: "relative", zIndex: 2, display: "flex", gap: 60, alignItems: "center", flexWrap: "wrap" }}>
        {/* Left: Copy */}
        <div style={{ flex: 1, minWidth: 340 }}>
          <div style={{
            opacity: ok ? 1 : 0, transform: ok ? "none" : "translateY(30px)",
            transition: "all 1s cubic-bezier(0.16,1,0.3,1) 0.1s",
          }}>
            {/* Instant badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: `linear-gradient(135deg, ${C.violet}15, ${C.gold}10)`,
              border: `1px solid ${C.violet}20`,
              borderRadius: 50, padding: "7px 16px", marginBottom: 28,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 12px #4ade80", animation: "pulse 2s infinite" }} />
              <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.violetGlow }}>Le paiement, c'est nous. Le business, c'est vous.</span>
            </div>
          </div>

          <h1 style={{
            opacity: ok ? 1 : 0, transform: ok ? "none" : "translateY(40px)",
            transition: "all 1s cubic-bezier(0.16,1,0.3,1) 0.25s",
            fontFamily: F.display, fontWeight: 800,
            fontSize: "clamp(38px, 6.5vw, 68px)", lineHeight: 0.98,
            color: "#fff", letterSpacing: "-3px", margin: "0 0 24px",
          }}>
            Votre fournisseur est{" "}
            <span style={{
              background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>payé</span>
            {" "}avant{" "}
            <span style={{ position: "relative", display: "inline-block" }}>
              <svg width="100%" height="8" viewBox="0 0 200 8" style={{ position: "absolute", bottom: -4, left: 0 }}>
                <path d="M0 4 Q50 0 100 4 Q150 8 200 4" stroke={C.gold} strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
              ce soir
            </span>
          </h1>

          <p style={{
            opacity: ok ? 1 : 0, transform: ok ? "none" : "translateY(30px)",
            transition: "all 1s cubic-bezier(0.16,1,0.3,1) 0.45s",
            fontFamily: F.body, fontSize: 18, color: C.muted,
            lineHeight: 1.65, margin: "0 0 36px", maxWidth: 440,
          }}>
            Alipay, WeChat, virement ou cash. Vous envoyez en francs CFA, votre fournisseur reçoit en yuan. Avec la <strong style={{ color: "#fff" }}>preuve dans votre poche</strong>.
          </p>

          <div style={{
            opacity: ok ? 1 : 0, transform: ok ? "none" : "translateY(20px)",
            transition: "all 1s cubic-bezier(0.16,1,0.3,1) 0.6s",
            display: "flex", gap: 12, flexWrap: "wrap",
          }}>
            <button style={{
              fontFamily: F.body, fontWeight: 800, fontSize: 16,
              background: C.violet, color: "#fff", border: "none",
              padding: "16px 32px", borderRadius: 14, cursor: "pointer",
              boxShadow: `0 0 40px ${C.violet}40, 0 0 80px ${C.violet}15`,
              transition: "all 0.3s",
            }}
              onMouseEnter={e => e.target.style.boxShadow = `0 0 50px ${C.violet}60, 0 0 100px ${C.violet}25`}
              onMouseLeave={e => e.target.style.boxShadow = `0 0 40px ${C.violet}40, 0 0 80px ${C.violet}15`}
            >Envoyer un paiement</button>
            <button style={{
              fontFamily: F.body, fontWeight: 600, fontSize: 15,
              background: "transparent", color: C.muted,
              border: `1px solid ${C.dim}`,
              padding: "16px 28px", borderRadius: 14, cursor: "pointer",
            }}>Voir les taux</button>
          </div>
        </div>

        {/* Right: Live converter card */}
        <div style={{
          opacity: ok ? 1 : 0, transform: ok ? "none" : "translateY(50px) rotateX(5deg)",
          transition: "all 1.2s cubic-bezier(0.16,1,0.3,1) 0.5s",
          width: 360, flexShrink: 0,
        }}>
          <div style={{
            background: `linear-gradient(160deg, ${C.surfaceLight}, ${C.surface})`,
            borderRadius: 24, padding: 28,
            border: `1px solid ${C.dim}`,
            boxShadow: `0 20px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
          }}>
            <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>Simulateur de paiement</div>

            {/* XAF Input */}
            <div style={{
              background: C.bg, borderRadius: 14, padding: "16px 18px",
              border: `1px solid ${C.dim}`, marginBottom: 10,
            }}>
              <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 6 }}>VOUS ENVOYEZ</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: F.display, fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>{xaf}</span>
                <span style={{
                  fontFamily: F.body, fontSize: 12, fontWeight: 700,
                  background: `${C.gold}15`, color: C.gold,
                  padding: "5px 12px", borderRadius: 8,
                }}>XAF</span>
              </div>
            </div>

            {/* Arrow */}
            <div style={{ textAlign: "center", margin: "4px 0" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: "50%",
                background: C.violet, color: "#fff", fontSize: 16,
                boxShadow: `0 4px 20px ${C.violet}40`,
              }}>↓</div>
            </div>

            {/* CNY Output */}
            <div style={{
              background: C.bg, borderRadius: 14, padding: "16px 18px",
              border: `1px solid ${C.dim}`, marginTop: 10,
            }}>
              <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 6 }}>FOURNISSEUR REÇOIT</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: F.display, fontSize: 28, fontWeight: 800, color: C.gold, letterSpacing: "-1px" }}>¥5 805</span>
                <span style={{
                  fontFamily: F.body, fontSize: 12, fontWeight: 700,
                  background: `${C.alipay}15`, color: C.alipay,
                  padding: "5px 12px", borderRadius: 8,
                }}>支 Alipay</span>
              </div>
            </div>

            {/* Rate */}
            <div style={{
              display: "flex", justifyContent: "space-between", marginTop: 14,
              fontFamily: F.body, fontSize: 11, color: C.muted,
            }}>
              <span>Taux: 1M XAF = ¥11 610</span>
              <span style={{ color: "#4ade80", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80" }} />
                Instantané
              </span>
            </div>

            {/* Quick amounts */}
            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
              {["100K", "500K", "1M", "5M"].map(q => (
                <button key={q} onClick={() => setXaf({"100K":"100 000","500K":"500 000","1M":"1 000 000","5M":"5 000 000"}[q])} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
                  fontFamily: F.body, fontWeight: 700, fontSize: 11,
                  background: xaf === {"100K":"100 000","500K":"500 000","1M":"1 000 000","5M":"5 000 000"}[q] ? `${C.violet}20` : `${C.dim}50`,
                  color: xaf === {"100K":"100 000","500K":"500 000","1M":"1 000 000","5M":"5 000 000"}[q] ? C.violetGlow : C.muted,
                  border: `1px solid ${xaf === {"100K":"100 000","500K":"500 000","1M":"1 000 000","5M":"5 000 000"}[q] ? C.violet + "30" : "transparent"}`,
                }}>{q}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.12; transform: scale(1); } 50% { opacity: 0.2; transform: scale(1.1); } }
      `}</style>
    </section>
  );
}

// ─── SCROLLING TICKER ───
function Ticker() {
  const items = ["Alipay", "WeChat Pay", "Virement bancaire", "Cash RMB", "Cameroun", "Gabon", "Tchad", "RCA", "Congo", "Paiement instantané", "Meilleur taux", "Sans carte"];
  return (
    <div style={{
      overflow: "hidden", background: C.violet,
      padding: "14px 0", position: "relative",
    }}>
      <div style={{
        display: "flex", gap: 48, whiteSpace: "nowrap",
        animation: "ticker 30s linear infinite",
      }}>
        {[...items, ...items, ...items].map((t, i) => (
          <span key={i} style={{
            fontFamily: F.display, fontSize: 14, fontWeight: 700,
            color: "#fff", letterSpacing: 1, textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.gold }} />
            {t}
          </span>
        ))}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-33.33%); } }`}</style>
    </div>
  );
}

// ─── BIG STATS ───
function Stats() {
  return (
    <section style={{ padding: "80px 24px", background: C.bg }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 40 }}>
        {[
          { end: 5, suffix: " pays", label: "Zone CEMAC couverte" },
          { end: 4, suffix: " modes", label: "De paiement acceptés" },
          { prefix: "<", end: 5, suffix: " min", label: "Temps de traitement moyen" },
          { end: 0, suffix: " frais", label: "Cachés. Jamais." },
        ].map((s, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: "clamp(48px, 8vw, 72px)", letterSpacing: "-3px" }}>
                <span style={{
                  background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  <Counter end={s.end} prefix={s.prefix || ""} suffix={s.suffix} />
                </span>
              </div>
              <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted, fontWeight: 500, marginTop: 4 }}>{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── HOW IT WORKS ───
function HowItWorks() {
  const steps = [
    { num: "01", title: "Choisissez", desc: "Alipay, WeChat, virement ou cash. Selon la preference de votre fournisseur." },
    { num: "02", title: "Montant", desc: "En XAF ou en yuan. Le taux instantane s'affiche, optimise selon le volume." },
    { num: "03", title: "Beneficiaire", desc: "QR code, identifiant ou coordonnees bancaires. Sauvegarde pour la prochaine fois." },
    { num: "04", title: "Instantane", desc: "Votre fournisseur recoit les fonds immediatement. Preuve de paiement dans l'app." },
  ];

  return (
    <section style={{ padding: "100px 24px", background: C.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <div style={{ marginBottom: 64 }}>
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: C.violet, textTransform: "uppercase", letterSpacing: 3 }}>Fonctionnement</span>
            <h2 style={{ fontFamily: F.display, fontWeight: 800, fontSize: "clamp(32px, 5vw, 52px)", color: "#fff", margin: "10px 0 0", letterSpacing: "-2px" }}>
              Quatre etapes.<br /><span style={{ color: C.muted }}>Cinq minutes.</span>
            </h2>
          </div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 2 }}>
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.12}>
              <div style={{
                padding: "40px 32px", background: C.surface,
                borderRadius: 0, position: "relative", overflow: "hidden",
                borderLeft: i === 0 ? "none" : `1px solid ${C.dim}`,
                transition: "all 0.4s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = C.surfaceLight}
                onMouseLeave={e => e.currentTarget.style.background = C.surface}
              >
                <span style={{
                  fontFamily: F.display, fontWeight: 800, fontSize: 80,
                  position: "absolute", top: -10, right: 10,
                  background: `linear-gradient(180deg, ${C.dim}40, transparent)`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  letterSpacing: "-4px",
                }}>{s.num}</span>
                <div style={{
                  width: 40, height: 3, borderRadius: 2,
                  background: `linear-gradient(90deg, ${C.gold}, ${C.orange})`,
                  marginBottom: 20,
                }} />
                <h3 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 24, color: "#fff", margin: "0 0 10px", letterSpacing: "-0.5px" }}>{s.title}</h3>
                <p style={{ fontFamily: F.body, fontSize: 14, color: C.muted, lineHeight: 1.6, margin: 0, position: "relative", zIndex: 2 }}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── METHODS ───
function Methods() {
  const m = [
    { icon: "支", name: "Alipay", color: C.alipay, tag: "Le plus populaire", desc: "QR code ou identifiant. Paiement instantane vers n'importe quel compte Alipay en Chine." },
    { icon: "微", name: "WeChat Pay", color: C.wechat, tag: "Rapide", desc: "Via l'ecosysteme WeChat. Ideal pour les fournisseurs qui utilisent WeChat au quotidien." },
    { icon: "🏦", name: "Virement", color: C.violet, tag: "Gros montants", desc: "Directement sur le compte bancaire de votre fournisseur. Pour les commandes importantes." },
    { icon: "¥", name: "Cash", color: C.orange, tag: "Sur place", desc: "Remise en especes avec signature de reception. Pour les fournisseurs qui preferent le cash." },
  ];

  return (
    <section style={{ padding: "100px 24px", background: C.surface }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: 3 }}>Modes de paiement</span>
            <h2 style={{ fontFamily: F.display, fontWeight: 800, fontSize: "clamp(28px, 4.5vw, 48px)", color: "#fff", margin: "10px 0 0", letterSpacing: "-2px" }}>
              Le mode que votre fournisseur prefere
            </h2>
          </div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {m.map((item, i) => (
            <Reveal key={item.name} delay={i * 0.1}>
              <div style={{
                padding: 32, borderRadius: 20,
                background: C.bg, border: `1px solid ${C.dim}`,
                cursor: "pointer", transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                position: "relative", overflow: "hidden",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${item.color}40`; e.currentTarget.style.transform = "translateY(-6px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.dim; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{
                  position: "absolute", bottom: -40, right: -40, width: 120, height: 120,
                  borderRadius: "50%", background: `${item.color}06`,
                }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: `${item.color}12`, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 26, color: item.color, fontWeight: 700,
                  }}>{item.icon}</div>
                  <span style={{
                    fontFamily: F.body, fontSize: 10, fontWeight: 700,
                    color: item.color, background: `${item.color}12`,
                    padding: "4px 10px", borderRadius: 20,
                    textTransform: "uppercase", letterSpacing: 0.5,
                  }}>{item.tag}</span>
                </div>
                <h3 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 22, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.5px" }}>{item.name}</h3>
                <p style={{ fontFamily: F.body, fontSize: 14, color: C.muted, lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ───
function FAQ() {
  const [open, setOpen] = useState(null);
  const faqs = [
    { q: "Les paiements sont-ils vraiment instantanes ?", a: "Oui. Les paiements Alipay et WeChat sont traites en quelques minutes. Les virements bancaires prennent generalement quelques heures. Le cash est immediat." },
    { q: "Quel est le montant minimum ?", a: "10 000 XAF par transaction. Pas de maximum, mais les gros montants beneficient d'un meilleur taux." },
    { q: "Comment le taux est-il calcule ?", a: "Le taux de base depend du mode de paiement. Un ajustement s'applique selon votre pays. Plus le montant est eleve, meilleur est le taux." },
    { q: "Comment mon fournisseur sait-il qu'il a ete paye ?", a: "Vous recevez une preuve de paiement dans l'application : capture d'ecran pour Alipay/WeChat, confirmation pour les virements, signature pour le cash." },
    { q: "Y a-t-il des frais caches ?", a: "Aucun. Le taux affiche est le taux final. Zero commission supplementaire, zero surprise." },
    { q: "Dans quels pays est disponible Bonzini ?", a: "Cameroun, Gabon, Tchad, Republique centrafricaine et Congo." },
  ];

  return (
    <section style={{ padding: "100px 24px", background: C.bg }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: C.violet, textTransform: "uppercase", letterSpacing: 3 }}>FAQ</span>
            <h2 style={{ fontFamily: F.display, fontWeight: 800, fontSize: "clamp(28px, 4vw, 40px)", color: "#fff", margin: "10px 0 0", letterSpacing: "-1.5px" }}>Vos questions</h2>
          </div>
        </Reveal>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {faqs.map((f, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <div style={{
                background: C.surface, borderRadius: 16, overflow: "hidden",
                border: `1px solid ${open === i ? C.violet + "30" : C.dim}`,
                transition: "all 0.3s",
              }}>
                <button onClick={() => setOpen(open === i ? null : i)} style={{
                  width: "100%", display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "20px 24px", border: "none",
                  background: "none", cursor: "pointer", textAlign: "left",
                }}>
                  <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 15, color: "#fff" }}>{f.q}</span>
                  <span style={{
                    fontFamily: F.display, fontSize: 24, color: C.muted,
                    transform: open === i ? "rotate(45deg)" : "none",
                    transition: "transform 0.3s", flexShrink: 0, marginLeft: 12,
                  }}>+</span>
                </button>
                <div style={{
                  maxHeight: open === i ? 200 : 0, overflow: "hidden",
                  transition: "max-height 0.5s cubic-bezier(0.16,1,0.3,1)",
                }}>
                  <div style={{ padding: "0 24px 20px", fontFamily: F.body, fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{f.a}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ───
function CTA() {
  return (
    <section style={{
      padding: "120px 24px", position: "relative", overflow: "hidden",
      background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${C.surfaceLight}, ${C.bg})`,
    }}>
      <div style={{
        position: "absolute", top: "50%", left: "50%", width: 500, height: 500,
        transform: "translate(-50%, -50%)", borderRadius: "50%",
        border: `1px solid ${C.dim}`, opacity: 0.3,
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%", width: 700, height: 700,
        transform: "translate(-50%, -50%)", borderRadius: "50%",
        border: `1px solid ${C.dim}`, opacity: 0.15,
      }} />

      <Reveal>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 2 }}>
          <Logo size={52} />
          <h2 style={{
            fontFamily: F.display, fontWeight: 800,
            fontSize: "clamp(32px, 5vw, 52px)", color: "#fff",
            margin: "28px 0 16px", letterSpacing: "-2px",
          }}>
            Vos fournisseurs attendent
          </h2>
          <p style={{ fontFamily: F.body, fontSize: 17, color: C.muted, lineHeight: 1.65, margin: "0 0 36px" }}>
            Chaque minute compte dans le commerce. Envoyez votre premier paiement maintenant.
          </p>
          <button style={{
            fontFamily: F.body, fontWeight: 800, fontSize: 17,
            background: `linear-gradient(135deg, ${C.violet}, #8b3cf0)`,
            color: "#fff", border: "none", padding: "20px 48px",
            borderRadius: 50, cursor: "pointer",
            boxShadow: `0 0 60px ${C.violet}40`,
          }}>Commencer maintenant</button>
        </div>
      </Reveal>
    </section>
  );
}

// ─── FOOTER ───
function Footer() {
  return (
    <footer style={{ padding: "56px 24px 28px", background: C.bg, borderTop: `1px solid ${C.dim}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 40, marginBottom: 40 }}>
          <div style={{ maxWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Logo size={24} />
              <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 17, color: "#fff" }}>Bonzini</span>
            </div>
            <p style={{ fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.6, opacity: 0.6 }}>
              Paiements instantanes vers la Chine pour les importateurs de la zone CEMAC.
            </p>
          </div>
          {[
            { t: "Produit", l: ["Fonctionnement", "Tarifs", "FAQ", "Securite"] },
            { t: "Entreprise", l: ["A propos", "Contact", "Mentions legales", "CGU"] },
            { t: "Support", l: ["WhatsApp", "Email", "Centre d'aide"] },
          ].map(col => (
            <div key={col.t}>
              <h4 style={{ fontFamily: F.body, fontWeight: 700, fontSize: 11, color: C.muted, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 1.5 }}>{col.t}</h4>
              {col.l.map(l => <a key={l} href="#" style={{ display: "block", fontFamily: F.body, fontSize: 14, color: C.dim, textDecoration: "none", padding: "3px 0" }}>{l}</a>)}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", borderRadius: 2, overflow: "hidden", height: 2, marginBottom: 20 }}>
          <div style={{ flex: 2, background: C.gold }} />
          <div style={{ flex: 3, background: C.violet }} />
          <div style={{ flex: 2, background: C.orange }} />
        </div>
        <div style={{ fontFamily: F.body, fontSize: 12, color: C.dim, textAlign: "center" }}>&copy; 2026 Bonzini. Tous droits reserves.</div>
      </div>
    </footer>
  );
}

// ─── MAIN ───
export default function App() {
  return (
    <div>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}body{overflow-x:hidden;background:${C.bg}}`}</style>
      <Nav />
      <Hero />
      <Ticker />
      <Stats />
      <HowItWorks />
      <Methods />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
