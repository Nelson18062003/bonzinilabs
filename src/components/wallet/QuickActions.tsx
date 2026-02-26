import { ArrowDownToLine, Send, History, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const actions = [
  { icon: ArrowDownToLine, label: 'Déposer', to: '/deposits/new', color: 'bg-success/10 text-success' },
  { icon: Send, label: 'Payer', to: '/payments/new', color: 'bg-primary/10 text-primary' },
  { icon: QrCode, label: 'Bénéficiaires', to: '/beneficiaries', color: 'bg-warning/10 text-warning' },
  { icon: History, label: 'Activité', to: '/history', color: 'bg-accent text-accent-foreground' },
];

export const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-4 gap-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => navigate(action.to)}
          className="flex flex-col items-center gap-1.5 p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-md transition-all active:scale-95"
        >
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl ${action.color} flex items-center justify-center`}>
            <action.icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="text-xs font-medium text-foreground">{action.label}</span>
        </button>
      ))}
    </div>
  );
};
