"use client";
import { useState } from "react";
import { Reveal } from "./Reveal";

const faqs = [
  {
    q: "Les paiements sont-ils vraiment instantanés ?",
    a: "Oui. Les paiements Alipay et WeChat sont traités en quelques minutes. Les virements bancaires prennent généralement quelques heures. Le cash est immédiat.",
  },
  {
    q: "Quel est le montant minimum ?",
    a: "10 000 XAF par transaction. Pas de maximum, mais les gros montants bénéficient d'un meilleur taux.",
  },
  {
    q: "Comment le taux est-il calculé ?",
    a: "Le taux de base dépend du mode de paiement. Un ajustement s'applique selon votre pays. Plus le montant est élevé, meilleur est le taux.",
  },
  {
    q: "Comment mon fournisseur sait-il qu'il a été payé ?",
    a: "Vous recevez une preuve de paiement dans l'application : capture d'écran pour Alipay/WeChat, confirmation pour les virements, signature pour le cash.",
  },
  {
    q: "Y a-t-il des frais cachés ?",
    a: "Aucun. Le taux affiché est le taux final. Zéro commission supplémentaire, zéro surprise.",
  },
  {
    q: "Dans quels pays est disponible Bonzini ?",
    a: "Cameroun, Gabon, Tchad, République centrafricaine et Congo.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-[100px] px-6 bg-brand-violet-deep">
      <div className="max-w-[680px] mx-auto">
        <Reveal>
          <div className="text-center mb-12">
            <span className="font-body text-xs font-bold text-brand-violet uppercase tracking-[3px]">
              FAQ
            </span>
            <h2
              className="font-display font-extrabold text-white mt-2.5 tracking-[-1.5px]"
              style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
            >
              Vos questions
            </h2>
          </div>
        </Reveal>

        <div className="flex flex-col gap-1.5">
          {faqs.map((f, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <div
                className={`bg-brand-surface rounded-[16px] overflow-hidden border transition-all duration-300 ${
                  open === i ? "border-brand-violet/30" : "border-brand-dim"
                }`}
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex justify-between items-center px-6 py-5 border-none bg-transparent cursor-pointer text-left"
                >
                  <span className="font-body font-bold text-[15px] text-white">
                    {f.q}
                  </span>
                  <span
                    className="font-display text-[24px] text-brand-muted flex-shrink-0 ml-3 transition-transform duration-300"
                    style={{ transform: open === i ? "rotate(45deg)" : "none" }}
                  >
                    +
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ maxHeight: open === i ? 200 : 0 }}
                >
                  <div className="px-6 pb-5 font-body text-sm text-brand-muted leading-[1.65]">
                    {f.a}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
