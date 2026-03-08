"use client";
import { useState, useEffect } from "react";
import { PaymentSimulator } from "./PaymentSimulator";

export function Hero({ alipayRate = 11610 }: { alipayRate?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  const base = "transition-all duration-[1s] ease-[cubic-bezier(0.16,1,0.3,1)]";
  const show = "opacity-100 translate-y-0";
  const hide = "opacity-0 translate-y-[30px]";

  return (
    <section className="min-h-screen bg-brand-violet-deep relative overflow-hidden flex items-center pt-[100px] pb-[60px] px-6">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[80%] rounded-full blur-[150px] opacity-20"
          style={{
            background: "conic-gradient(from 180deg, #a64af7, #f3a745, #fe560d, #a64af7)",
            animation: "spin 20s linear infinite",
          }}
        />
        <div
          className="absolute bottom-[-30%] right-[-15%] w-[50%] h-[70%] rounded-full blur-[140px] opacity-[0.12]"
          style={{
            background: "radial-gradient(circle, #f3a745, transparent)",
            animation: "pulse-glow 6s ease-in-out infinite",
          }}
        />
        <div className="noise-overlay absolute inset-0" />
      </div>

      <div className="max-w-[1200px] mx-auto w-full relative z-10 flex gap-[60px] items-center flex-wrap lg:flex-nowrap">
        {/* Left: Copy */}
        <div className="flex-1 min-w-[300px]">
          {/* Badge */}
          <div
            className={`${base} ${visible ? show : "opacity-0 translate-y-[30px]"}`}
            style={{ transitionDelay: "0.1s" }}
          >
            <div className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-violet/15 to-brand-gold/10 border border-brand-violet/20 rounded-full px-4 py-[7px] mb-7">
              <div
                className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_12px_#4ade80]"
                style={{ animation: "pulse-glow 2s infinite" }}
              />
              <span className="font-body text-[13px] font-semibold text-brand-violet-glow">
                Le paiement, c&apos;est nous. Le business, c&apos;est vous.
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1
            className={`${base} font-display font-extrabold leading-none tracking-[-3px] text-white mb-6`}
            style={{
              fontSize: "clamp(38px, 6.5vw, 68px)",
              transitionDelay: "0.25s",
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateY(40px)",
            }}
          >
            Votre fournisseur est{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #f3a745, #fe560d)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              payé
            </span>{" "}
            avant{" "}
            <span className="relative inline-block">
              <svg
                width="100%"
                height="8"
                viewBox="0 0 200 8"
                className="absolute bottom-[-4px] left-0"
              >
                <path
                  d="M0 4 Q50 0 100 4 Q150 8 200 4"
                  stroke="#f3a745"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              ce soir
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className={`${base} font-body text-lg text-brand-muted leading-[1.65] mb-9 max-w-[440px]`}
            style={{
              transitionDelay: "0.45s",
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateY(30px)",
            }}
          >
            Alipay, WeChat, virement ou cash. Vous envoyez en francs CFA, votre
            fournisseur reçoit en yuan. Avec la{" "}
            <strong className="text-white">preuve dans votre poche</strong>.
          </p>

          {/* CTAs */}
          <div
            className={`${base} flex gap-3 flex-wrap`}
            style={{
              transitionDelay: "0.6s",
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateY(20px)",
            }}
          >
            <button
              className="font-body font-black text-base text-white bg-brand-violet border-none px-8 py-4 rounded-[14px] cursor-pointer transition-all shadow-[0_0_40px_rgba(166,74,247,0.4),0_0_80px_rgba(166,74,247,0.15)] hover:shadow-[0_0_50px_rgba(166,74,247,0.6),0_0_100px_rgba(166,74,247,0.25)]"
            >
              Envoyer un paiement
            </button>
            <button className="font-body font-semibold text-[15px] text-brand-muted bg-transparent border border-brand-dim px-7 py-4 rounded-[14px] cursor-pointer hover:text-white hover:border-brand-muted transition-all">
              Voir les taux
            </button>
          </div>
        </div>

        {/* Right: Simulator */}
        <div
          className={`${base} w-full lg:w-[360px] flex-shrink-0`}
          style={{
            transitionDelay: "0.5s",
            opacity: visible ? 1 : 0,
            transform: visible ? "none" : "translateY(50px) rotateX(5deg)",
          }}
        >
          <PaymentSimulator alipayRate={alipayRate} />
        </div>
      </div>
    </section>
  );
}
