import { Reveal } from "./Reveal";

const steps = [
  {
    num: "01",
    title: "Choisissez",
    desc: "Alipay, WeChat, virement ou cash. Selon la préférence de votre fournisseur.",
  },
  {
    num: "02",
    title: "Montant",
    desc: "En XAF ou en yuan. Le taux instantané s'affiche, optimisé selon le volume.",
  },
  {
    num: "03",
    title: "Bénéficiaire",
    desc: "QR code, identifiant ou coordonnées bancaires. Sauvegardé pour la prochaine fois.",
  },
  {
    num: "04",
    title: "Instantané",
    desc: "Votre fournisseur reçoit les fonds immédiatement. Preuve de paiement dans l'app.",
  },
];

export function HowItWorks() {
  return (
    <section id="fonctionnement" className="py-[100px] px-6 bg-brand-violet-deep">
      <div className="max-w-[1200px] mx-auto">
        <Reveal>
          <div className="mb-16">
            <span className="font-body text-xs font-bold text-brand-violet uppercase tracking-[3px]">
              Fonctionnement
            </span>
            <h2
              className="font-display font-extrabold text-white mt-2.5 tracking-[-2px]"
              style={{ fontSize: "clamp(32px, 5vw, 52px)" }}
            >
              Quatre étapes.
              <br />
              <span className="text-brand-muted">Cinq minutes.</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[2px]">
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.12}>
              <div
                className={`p-10 bg-brand-surface relative overflow-hidden transition-all duration-400 hover:bg-brand-surface-light ${
                  i !== 0 ? "border-l border-brand-dim" : ""
                } lg:border-l ${i === 0 ? "lg:border-l-0" : ""}`}
              >
                {/* Ghost number */}
                <span
                  className="absolute top-[-10px] right-[10px] font-display font-extrabold text-[80px] tracking-[-4px] select-none pointer-events-none"
                  style={{
                    background: "linear-gradient(180deg, rgba(61,53,85,0.4), transparent)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {s.num}
                </span>

                {/* Accent bar */}
                <div className="w-10 h-[3px] rounded-sm bg-gradient-to-r from-brand-gold to-brand-orange mb-5" />

                <h3 className="font-display font-extrabold text-[24px] text-white tracking-[-0.5px] mb-2.5">
                  {s.title}
                </h3>
                <p className="font-body text-sm text-brand-muted leading-[1.6] relative z-10">
                  {s.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
