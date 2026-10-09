// ============================================================
// « Enregistré par » sur la fiche client (desktop et mobile) : le
// collaborateur qui a créé la fiche, son rôle et son site ce jour-là.
// Lecture seule — posé par la base à la création, jamais modifiable.
// ============================================================
import { cn } from '@/lib/utils';
import { useClientOrigin } from '@/hooks/useClientSources';
import { clientRegistration, registrationDate, registrationText } from '@/lib/clientRegistration';

export function ClientRegistration({ userId, className }: { userId: string; className?: string }) {
  const origin = useClientOrigin(userId);
  if (origin.isLoading) return <span className={cn('text-muted-foreground', className)}>…</span>;
  const r = clientRegistration(origin.data);
  const date = registrationDate(r);
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-1.5', className)}>
      <span className={r.kind === 'staff' ? 'font-medium' : 'text-muted-foreground'}>{registrationText(r)}</span>
      {date && <span className="text-[12.5px] text-muted-foreground">{date}</span>}
    </span>
  );
}
