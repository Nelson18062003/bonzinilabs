import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

interface PrimaryCTAProps {
  /** Override the default label */
  label?: string;
  /** Override the default destination */
  to?: string;
}

/**
 * Primary Call-to-Action button for the home screen
 *
 * Feature 3 requirements:
 * - Visible and prominent
 * - Located below the balance card
 * - Large touch target (minimum 48px height)
 * - Branded color (Bonzini purple)
 * - Opens deposit flow
 */
export const PrimaryCTA = ({
  label = "Ajouter de l'argent",
  to = "/deposits/new"
}: PrimaryCTAProps) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className="
        w-full h-14
        flex items-center justify-center gap-3
        bg-primary hover:bg-primary/90
        text-primary-foreground font-semibold text-base
        rounded-2xl
        shadow-lg shadow-primary/25
        transition-all duration-200
        active:scale-[0.98] active:shadow-md
        animate-fade-in
      "
      style={{ animationDelay: '50ms' }}
    >
      <Plus className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
};
