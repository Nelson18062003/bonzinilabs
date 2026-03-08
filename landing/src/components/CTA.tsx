import { Reveal } from "./Reveal";
import { BonziniLogo } from "./BonziniLogo";

export function CTA() {
  return (
    <section
      className="py-[120px] px-6 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 50% 50%, #1a1428, #050208)",
      }}
    >
      {/* Decorative rings */}
      <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-dim opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 w-[700px] h-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-dim opacity-15 pointer-events-none" />

      <Reveal>
        <div className="max-w-[560px] mx-auto text-center relative z-10">
          <div className="flex justify-center mb-7">
            <BonziniLogo size={52} />
          </div>
          <h2
            className="font-display font-extrabold text-white tracking-[-2px] mb-4"
            style={{ fontSize: "clamp(32px, 5vw, 52px)" }}
          >
            Vos fournisseurs attendent
          </h2>
          <p className="font-body text-[17px] text-brand-muted leading-[1.65] mb-9">
            Chaque minute compte dans le commerce. Envoyez votre premier
            paiement maintenant.
          </p>
          <button
            className="font-body font-black text-[17px] text-white border-none px-12 py-5 rounded-full cursor-pointer transition-all shadow-[0_0_60px_rgba(166,74,247,0.4)] hover:shadow-[0_0_80px_rgba(166,74,247,0.6)]"
            style={{
              background: "linear-gradient(135deg, #a64af7, #8b3cf0)",
            }}
          >
            Commencer maintenant
          </button>
        </div>
      </Reveal>
    </section>
  );
}
