import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Primary CTA for the home screen - Feature 3
 * 
 * Requirements:
 * - Visible, prominent, centered
 * - Large button in Bonzini violet
 * - Navigates to deposit flow
 * - Impossible to miss
 */
export const PrimaryCTA = () => {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
      <Button
        onClick={() => navigate('/deposits/new')}
        className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
        size="lg"
      >
        <Plus className="w-5 h-5 mr-2" />
        Ajouter de l'argent
      </Button>
    </div>
  );
};
