import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Lock } from 'lucide-react';
import { PaymentStatusCard } from '@/components/payment-detail/PaymentStatusCard';

describe('PaymentStatusCard', () => {
  it('renders title and description', () => {
    render(
      <PaymentStatusCard
        variant="info"
        title="Prêt à être traité"
        description="Bonzini va régler votre fournisseur."
      />,
    );
    expect(screen.getByText('Prêt à être traité')).toBeInTheDocument();
    expect(screen.getByText('Bonzini va régler votre fournisseur.')).toBeInTheDocument();
  });

  it('renders without a description when none is provided', () => {
    render(<PaymentStatusCard variant="success" title="Effectué" />);
    expect(screen.getByText('Effectué')).toBeInTheDocument();
  });

  it('renders custom children below the description', () => {
    render(
      <PaymentStatusCard variant="success" title="OK">
        <span data-testid="custom-child">extra content</span>
      </PaymentStatusCard>,
    );
    expect(screen.getByTestId('custom-child')).toBeInTheDocument();
  });

  it('accepts a custom icon override (no crash, renders an svg)', () => {
    const { container } = render(
      <PaymentStatusCard variant="cancelled" title="Annulé" icon={Lock} />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies the spinIcon animation class when requested', () => {
    const { container } = render(
      <PaymentStatusCard variant="progress" title="En cours" spinIcon />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('animate-spin')).toBe(true);
  });

  it('honours additional className on the outer container', () => {
    const { container } = render(
      <PaymentStatusCard
        variant="info"
        title="Test"
        className="my-extra-class"
      />,
    );
    expect(container.firstChild).toHaveClass('my-extra-class');
  });
});
