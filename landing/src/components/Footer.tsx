import { BonziniLogo } from "./BonziniLogo";

const columns = [
  {
    title: "Produit",
    links: ["Fonctionnement", "Tarifs", "FAQ", "Sécurité"],
  },
  {
    title: "Entreprise",
    links: ["À propos", "Contact", "Mentions légales", "CGU"],
  },
  {
    title: "Support",
    links: ["WhatsApp", "Email", "Centre d'aide"],
  },
];

export function Footer() {
  return (
    <footer className="pt-14 pb-7 px-6 bg-brand-violet-deep border-t border-brand-dim">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex justify-between flex-wrap gap-10 mb-10">
          {/* Brand */}
          <div className="max-w-[260px]">
            <div className="flex items-center gap-2 mb-3.5">
              <BonziniLogo size={24} />
              <span className="font-display font-extrabold text-[17px] text-white">
                Bonzini
              </span>
            </div>
            <p className="font-body text-[13px] text-brand-muted leading-[1.6] opacity-60">
              Paiements instantanés vers la Chine pour les importateurs de la
              zone CEMAC.
            </p>
          </div>

          {/* Columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-body font-bold text-[11px] text-brand-muted uppercase tracking-[1.5px] mb-3">
                {col.title}
              </h4>
              {col.links.map((l) => (
                <a
                  key={l}
                  href="#"
                  className="block font-body text-sm text-brand-dim hover:text-brand-muted transition-colors py-[3px]"
                >
                  {l}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Tricolor bar */}
        <div className="flex rounded-sm overflow-hidden h-[2px] mb-5">
          <div className="flex-[2] bg-brand-gold" />
          <div className="flex-[3] bg-brand-violet" />
          <div className="flex-[2] bg-brand-orange" />
        </div>

        <div className="font-body text-xs text-brand-dim text-center">
          &copy; 2026 Bonzini. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
