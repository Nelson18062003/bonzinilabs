import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { BonziniLogo } from '@/components/BonziniLogo';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ArrowRight,
  Menu,
  X,
  UserPlus,
  ArrowDownToLine,
  CheckCircle2,
  TrendingUp,
  Zap,
  Shield,
  Activity,
  Headphones,
  Smartphone,
} from 'lucide-react';

// ── Logo palette — 3 couleurs extraites du logo Bonzini ──────────────────────
// Purple  hsl(258 100% 60%) — ailes du logo — confiance, tech
// Amber   hsl(36  100% 55%) — "U" du logo   — chaleur, taux, valeur
// Orange  hsl(16  100% 55%) — "n" du logo   — énergie, CTA, vitesse

// ── Shared animation variants ────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as number[] },
  },
};

// ── LandingNav ───────────────────────────────────────────────────────────────
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-[#0a0515]/85 backdrop-blur-xl border-b border-white/10'
          : 'bg-transparent',
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          aria-label="Accueil"
        >
          <BonziniLogo size="sm" showText textPosition="right" className="[&_span]:text-white [&_span]:font-bold" />
        </button>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            to="/auth"
            className="text-white/80 hover:text-white text-sm font-medium transition-colors px-4 py-2"
          >
            Se connecter
          </Link>
          <Link
            to="/auth"
            className="btn-primary-gradient text-sm px-5 py-2.5 rounded-xl font-semibold"
          >
            Ouvrir un compte
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-white/80 hover:text-white p-2 transition-colors"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="sm:hidden bg-[#0a0515]/95 backdrop-blur-xl border-b border-white/10 px-4 pb-4 space-y-2"
        >
          <Link
            to="/auth"
            className="block py-3 text-white/80 hover:text-white text-sm font-medium transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            Se connecter
          </Link>
          <Link
            to="/auth"
            className="block btn-primary-gradient text-center py-3 rounded-xl text-sm font-semibold"
            onClick={() => setMobileOpen(false)}
          >
            Ouvrir un compte
          </Link>
        </motion.div>
      )}
    </header>
  );
}

// ── HeroSection ──────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0a0515] via-[#0f0a2e] to-[#0a0515]">
      {/* Animated gradient orbs — tricolores */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Orbe 1 : Violet (ailes) */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(258 100% 60% / 0.22) 0%, transparent 70%)',
            top: '-15%',
            left: '-20%',
          }}
          animate={{ x: [0, 40, 0], y: [0, -25, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Orbe 2 : Orange (énergie) */}
        <motion.div
          className="absolute w-[700px] h-[700px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(16 100% 55% / 0.18) 0%, transparent 70%)',
            bottom: '-25%',
            right: '-25%',
          }}
          animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        {/* Orbe 3 : Ambre (chaleur) */}
        <motion.div
          className="absolute w-[350px] h-[350px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(36 100% 55% / 0.12) 0%, transparent 70%)',
            top: '45%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto pt-20">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(36_100%_55%/0.15)] border border-[hsl(36_100%_55%/0.35)] text-[hsl(36_100%_70%)] text-xs font-semibold tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(16_100%_55%)] animate-pulse" />
              Paiements vers la Chine · Depuis l'Afrique
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-[1.08] tracking-tight"
          >
            Réglez vos fournisseurs
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[hsl(36_100%_70%)] via-white to-[hsl(16_100%_65%)] bg-clip-text text-transparent">
              chinois en XAF.
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed"
          >
            Vous importez depuis la Chine ? Bonzini règle directement vos fournisseurs
            sur Alipay, WeChat Pay ou par virement — en XAF, au meilleur taux, sous 24h.
            Sans carte internationale. Sans blocage.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
          >
            <Link
              to="/auth"
              className="w-full sm:w-auto btn-primary-gradient px-8 py-4 rounded-xl text-base font-semibold text-center transition-all duration-300 hover:-translate-y-0.5"
              style={{ boxShadow: '0 8px 32px -8px hsl(258 100% 60% / 0.55)' }}
            >
              Créer un compte gratuit
            </Link>
            <Link
              to="/auth"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300 text-center backdrop-blur-sm"
            >
              Se connecter
            </Link>
          </motion.div>

          {/* Trust stats */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 pt-4"
          >
            {[
              { value: '500+', label: 'Importateurs actifs' },
              { value: '24h', label: 'Délai maximum' },
              { value: '0', label: 'Blocage de paiement' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold text-white">{stat.value}</div>
                <div className="text-xs sm:text-sm text-white/45 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/25"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown className="w-6 h-6" />
      </motion.div>
    </section>
  );
}

// ── TrustBar ─────────────────────────────────────────────────────────────────
function TrustBar() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const methods = [
    {
      emoji: '📱',
      chineseLabel: '支付宝',
      label: 'Alipay',
      color: 'hsl(36 100% 55%)',
    },
    {
      emoji: '💬',
      chineseLabel: '微信支付',
      label: 'WeChat Pay',
      color: 'hsl(16 100% 55%)',
    },
    {
      emoji: '🏦',
      chineseLabel: '银行转账',
      label: 'Virement',
      color: 'hsl(258 100% 60%)',
    },
  ];

  return (
    <section className="bg-[#0a0515] border-y border-white/5 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12"
        >
          <p className="text-white/35 text-xs uppercase tracking-widest font-semibold whitespace-nowrap">
            Méthodes de paiement acceptées en Chine
          </p>
          <div className="flex items-center gap-8 sm:gap-12">
            {methods.map(m => (
              <div key={m.label} className="flex flex-col items-center gap-1.5">
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-white/40 text-xs font-medium">{m.label}</span>
                <span className="text-white/20 text-[10px]">{m.chineseLabel}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── HowItWorksSection ────────────────────────────────────────────────────────
function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const steps = [
    {
      icon: UserPlus,
      title: 'Créez votre compte',
      description:
        'Inscription gratuite en 2 minutes. Aucun document complexe. Vous êtes opérationnel immédiatement.',
      // Violet
      iconBg: 'bg-[hsl(258_100%_60%/0.15)]',
      iconBorder: 'border-[hsl(258_100%_60%/0.25)]',
      iconColor: 'text-[hsl(258_100%_72%)]',
      badgeBg: 'bg-[hsl(258_100%_60%)]',
      badgeText: 'text-white',
    },
    {
      icon: ArrowDownToLine,
      title: 'Déposez en XAF',
      description:
        'Mobile Money ou virement depuis votre banque locale. Votre solde Bonzini est crédité rapidement, sans frais cachés.',
      // Ambre
      iconBg: 'bg-[hsl(36_100%_55%/0.15)]',
      iconBorder: 'border-[hsl(36_100%_55%/0.25)]',
      iconColor: 'text-[hsl(36_100%_70%)]',
      badgeBg: 'bg-[hsl(36_100%_50%)]',
      badgeText: 'text-black',
    },
    {
      icon: CheckCircle2,
      title: 'Votre fournisseur reçoit',
      description:
        'Paiement direct sur son Alipay, WeChat Pay ou compte bancaire chinois. Sous 24h. Il reçoit exactement le montant convenu.',
      // Orange
      iconBg: 'bg-[hsl(16_100%_55%/0.15)]',
      iconBorder: 'border-[hsl(16_100%_55%/0.25)]',
      iconColor: 'text-[hsl(16_100%_70%)]',
      badgeBg: 'bg-[hsl(16_100%_55%)]',
      badgeText: 'text-white',
    },
  ];

  return (
    <section className="bg-gradient-to-b from-[#0a0515] to-[#080312] py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {/* Section header */}
          <motion.div variants={itemVariants} className="text-center mb-16">
            <p className="text-[hsl(36_100%_65%)] text-xs font-semibold uppercase tracking-widest mb-3">
              De l'Afrique à la Chine en 3 étapes
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Comment ça marche ?
            </h2>
            <p className="text-white/50 text-base sm:text-lg max-w-xl mx-auto">
              Pas de banque internationale. Pas d'intermédiaire. Juste votre paiement, là où il doit aller.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
            {/* Connecting line — desktop only — gradient tricolore */}
            <div
              className="hidden md:block absolute top-11 left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-px"
              style={{
                background: 'linear-gradient(to right, hsl(258 100% 60% / 0.5), hsl(36 100% 55% / 0.7), hsl(16 100% 55% / 0.5))',
              }}
            />

            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                variants={itemVariants}
                className="relative flex flex-col items-center text-center px-4"
              >
                {/* Icon circle */}
                <div className="relative mb-6">
                  <div className={cn('w-14 h-14 rounded-2xl border flex items-center justify-center backdrop-blur-sm', step.iconBg, step.iconBorder)}>
                    <step.icon className={cn('w-6 h-6', step.iconColor)} />
                  </div>
                  <span className={cn('absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center', step.badgeBg, step.badgeText)}>
                    {i + 1}
                  </span>
                </div>

                <h3 className="text-white font-bold text-lg sm:text-xl mb-3">{step.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── PaymentMethodsSection ────────────────────────────────────────────────────
function PaymentMethodsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const methods = [
    {
      emoji: '📱',
      chineseLabel: '支付宝',
      title: 'Alipay',
      description:
        "Le standard des paiements en Chine. Plus de 900 millions d'utilisateurs. Votre fournisseur l'a forcément.",
      badge: 'Instantané',
      badgeClass: 'text-[hsl(36_100%_70%)] bg-[hsl(36_100%_55%/0.12)] border-[hsl(36_100%_55%/0.25)]',
      hoverBorder: 'hover:border-[hsl(36_100%_55%/0.4)]',
    },
    {
      emoji: '💬',
      chineseLabel: '微信支付',
      title: 'WeChat Pay',
      description:
        "Intégré à l'application que tous les commerçants chinois utilisent au quotidien. Paiement en quelques secondes.",
      badge: 'Populaire',
      badgeClass: 'text-[hsl(16_100%_70%)] bg-[hsl(16_100%_55%/0.12)] border-[hsl(16_100%_55%/0.25)]',
      hoverBorder: 'hover:border-[hsl(16_100%_55%/0.4)]',
    },
    {
      emoji: '🏦',
      chineseLabel: '银行转账',
      title: 'Virement bancaire',
      description:
        'Pour les montants importants ou les entreprises chinoises sans portefeuille numérique. Sécurisé, traçable, sans limite.',
      badge: 'Grandes sommes',
      badgeClass: 'text-[hsl(258_100%_75%)] bg-[hsl(258_100%_60%/0.12)] border-[hsl(258_100%_60%/0.25)]',
      hoverBorder: 'hover:border-[hsl(258_100%_60%/0.4)]',
    },
  ];

  return (
    <section className="bg-[#080312] py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {/* Section header */}
          <motion.div variants={itemVariants} className="text-center mb-14">
            <p className="text-[hsl(16_100%_65%)] text-xs font-semibold uppercase tracking-widest mb-3">
              Paiements directs vers la Chine
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Payé directement sur leur compte
            </h2>
            <p className="text-white/50 text-base max-w-xl mx-auto">
              Pas de SWIFT, pas d'intermédiaire opaque. Votre fournisseur reçoit son argent là où il l'attend.
            </p>
          </motion.div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {methods.map(m => (
              <motion.div
                key={m.title}
                variants={itemVariants}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className={cn(
                  'relative p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/[0.07] transition-colors duration-300',
                  m.hoverBorder,
                )}
              >
                {/* Header */}
                <div className="flex items-center gap-4 mb-5">
                  <span className="text-4xl">{m.emoji}</span>
                  <div>
                    <p className="text-white/25 text-xs font-medium">{m.chineseLabel}</p>
                    <h3 className="text-white font-bold text-xl leading-tight">{m.title}</h3>
                  </div>
                </div>

                <p className="text-white/45 text-sm leading-relaxed mb-5">{m.description}</p>

                <span
                  className={cn(
                    'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
                    m.badgeClass,
                  )}
                >
                  {m.badge}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── WhyBonziniSection ────────────────────────────────────────────────────────
function WhyBonziniSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const features = [
    {
      icon: TrendingUp,
      title: 'Taux direct, sans surprise',
      description:
        'Nous accédons aux taux de change interbancaires. Pas de marge cachée. Vous savez exactement ce que vous payez avant de valider.',
      cardClass: 'bg-[hsl(36_100%_55%/0.12)] border-[hsl(36_100%_55%/0.3)] hover:bg-[hsl(36_100%_55%/0.18)]',
      iconBg: 'bg-[hsl(36_100%_55%/0.25)]',
      iconColor: 'text-[hsl(36_100%_70%)]',
    },
    {
      icon: Zap,
      title: 'Paiement en moins de 24h',
      description:
        "Votre fournisseur reçoit son règlement le lendemain. Fini l'attente de 3 à 5 jours ouvrables.",
      cardClass: 'bg-[hsl(16_100%_55%/0.10)] border-[hsl(16_100%_55%/0.25)] hover:bg-[hsl(16_100%_55%/0.16)]',
      iconBg: 'bg-[hsl(16_100%_55%/0.25)]',
      iconColor: 'text-[hsl(16_100%_70%)]',
    },
    {
      icon: Shield,
      title: 'Accès direct Alipay & WeChat',
      description:
        'Votre carte est refusée ? Pas avec Bonzini. Nous avons les accès directs aux réseaux de paiement chinois.',
      cardClass: 'bg-[hsl(258_100%_60%/0.12)] border-[hsl(258_100%_60%/0.3)] hover:bg-[hsl(258_100%_60%/0.18)]',
      iconBg: 'bg-[hsl(258_100%_60%/0.25)]',
      iconColor: 'text-[hsl(258_100%_72%)]',
    },
    {
      icon: Activity,
      title: 'Suivi en temps réel',
      description:
        'Notification à chaque étape. Vous savez exactement où en est votre paiement, de la validation à la réception.',
      cardClass: 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]',
      iconBg: 'bg-white/10',
      iconColor: 'text-white/60',
    },
    {
      icon: Headphones,
      title: 'Support humain',
      description:
        'Un conseiller disponible pour répondre à vos questions. En français. Par vous, pour vous.',
      cardClass: 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]',
      iconBg: 'bg-white/10',
      iconColor: 'text-white/60',
    },
    {
      icon: Smartphone,
      title: "Aussi simple qu'un virement local",
      description:
        'Interface pensée pour des entrepreneurs, pas des banquiers. 3 clics suffisent.',
      cardClass: 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]',
      iconBg: 'bg-white/10',
      iconColor: 'text-white/60',
    },
  ];

  return (
    <section className="bg-gradient-to-b from-[#080312] to-[#0a0515] py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {/* Section header */}
          <motion.div variants={itemVariants} className="text-center mb-14">
            <p className="text-[hsl(258_100%_70%)] text-xs font-semibold uppercase tracking-widest mb-3">
              Conçu pour les importateurs africains
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Pourquoi Bonzini ?
            </h2>
            <p className="text-white/50 text-base max-w-xl mx-auto">
              Nous avons vécu vos galères. Cartes refusées, taux opaques, virements bloqués.
              Bonzini est la solution que vous attendiez.
            </p>
          </motion.div>

          {/* Features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => (
              <motion.div
                key={f.title}
                variants={itemVariants}
                className={cn(
                  'p-6 rounded-2xl border transition-all duration-300',
                  f.cardClass,
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', f.iconBg)}>
                  <f.icon className={cn('w-5 h-5', f.iconColor)} />
                </div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── CtaBannerSection ─────────────────────────────────────────────────────────
function CtaBannerSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section className="py-24 px-4 bg-[#0a0515]">
      <div className="max-w-4xl mx-auto">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="relative overflow-hidden rounded-3xl px-8 py-16 sm:py-20 text-center"
          style={{
            background: 'linear-gradient(135deg, hsl(36 100% 45%), hsl(258 100% 50%), hsl(16 100% 45%))',
            boxShadow: '0 24px 80px -16px hsl(258 100% 60% / 0.4), 0 0 60px -20px hsl(16 100% 55% / 0.25)',
          }}
        >
          {/* Decorative blobs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl" aria-hidden="true">
            <div className="absolute w-72 h-72 rounded-full bg-white/10 blur-3xl -top-12 -right-12" />
            <div className="absolute w-52 h-52 rounded-full bg-white/5 blur-2xl bottom-0 left-0" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            <motion.p
              variants={itemVariants}
              className="text-white/75 text-xs font-semibold uppercase tracking-widest mb-4"
            >
              Votre prochain paiement en Chine
            </motion.p>

            <motion.h2
              variants={itemVariants}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-5 tracking-tight"
            >
              Prêt à régler votre fournisseur ?
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className="text-white/70 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed"
            >
              Des centaines d'importateurs africains utilisent Bonzini pour régler leurs
              partenaires chinois chaque semaine. Sans blocage. Sans surprise.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                to="/auth"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-[hsl(258_100%_40%)] font-bold px-8 py-4 rounded-xl text-base hover:bg-white/92 transition-all duration-200 hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
              >
                Ouvrir mon compte gratuitement
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>

            <motion.p
              variants={itemVariants}
              className="mt-5 text-white/45 text-xs"
            >
              Inscription gratuite — Aucune carte bancaire requise
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── LandingFooter ────────────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer className="bg-[#080312] border-t border-white/5 px-4 py-14">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div className="space-y-4">
            <BonziniLogo size="sm" showText textPosition="right" className="[&_span]:text-white [&_span]:font-bold" />
            <p className="text-white/35 text-sm leading-relaxed max-w-xs">
              La solution de paiement vers la Chine pour la diaspora africaine francophone.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">
              Accès rapide
            </p>
            <ul className="space-y-2.5">
              {[
                { label: 'Se connecter', to: '/auth' },
                { label: 'Ouvrir un compte', to: '/auth' },
              ].map(link => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-white/35 hover:text-white/70 text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + Legal */}
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">
              Contact
            </p>
            <ul className="space-y-2.5 mb-6">
              <li>
                <a
                  href="mailto:contact@bonzinilabs.com"
                  className="text-white/35 hover:text-white/70 text-sm transition-colors"
                >
                  contact@bonzinilabs.com
                </a>
              </li>
            </ul>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">
              Légal
            </p>
            <ul className="space-y-2.5">
              {['Mentions légales', 'Confidentialité', 'CGU'].map(item => (
                <li key={item}>
                  <a href="#" className="text-white/35 hover:text-white/70 text-sm transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Ligne de séparation tricolore */}
        <div
          className="h-px mb-6"
          style={{
            background: 'linear-gradient(to right, hsl(36 100% 55% / 0.4), hsl(258 100% 60% / 0.6), hsl(16 100% 55% / 0.4))',
          }}
        />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/20 text-xs">
            © {new Date().getFullYear()} BonziniLabs. Tous droits réservés.
          </p>
          <p className="text-white/20 text-xs">
            Fait avec soin pour la diaspora africaine 🌍
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── LandingPage (default export) ─────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0515] text-white">
      <LandingNav />
      <HeroSection />
      <TrustBar />
      <HowItWorksSection />
      <PaymentMethodsSection />
      <WhyBonziniSection />
      <CtaBannerSection />
      <LandingFooter />
    </div>
  );
}
