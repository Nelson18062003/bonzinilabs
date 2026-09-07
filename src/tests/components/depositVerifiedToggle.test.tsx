/**
 * « VÉRIFIÉ EN BANQUE » — la case du rapprochement bancaire.
 *
 * Ce que ce composant doit tenir, et pourquoi chaque point compte :
 *
 *  · c'est un AXE À PART du statut. Un dépôt validé n'est pas vérifié pour
 *    autant : c'est précisément l'écart que l'opérateur veut voir en fin de
 *    journée, quand il appelle son partenaire pour pointer les comptes ;
 *  · le clic demande L'INVERSE de l'état courant — sinon on ne peut jamais
 *    retirer une vérification posée par erreur ;
 *  · le clic ne doit PAS ouvrir la fiche. La ligne entière est cliquable :
 *    sans `stopPropagation`, cocher « vérifié » ferait aussi basculer l'écran ;
 *  · sans le droit de traiter les dépôts, on VOIT l'état sans pouvoir le
 *    changer — et il n'y a alors aucun bouton à cliquer.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DepositVerifiedToggle,
  verifiedState,
  verifiedTitle,
} from '@/desktop/screens/deposits/DepositVerifiedToggle';

const AT = '2026-09-07T13:30:00.000Z';

describe("L'état, et ce que le clic demandera", () => {
  it('non vérifié : le clic demandera « vrai »', () => {
    expect(verifiedState(null)).toEqual({ verified: false, label: 'À vérifier', next: true });
    expect(verifiedState(undefined).verified).toBe(false);
  });

  it('vérifié : le clic demandera « faux » — une vérification posée par erreur se retire', () => {
    expect(verifiedState(AT)).toEqual({ verified: true, label: 'Vérifié', next: false });
  });
});

describe("L'infobulle", () => {
  it('porte la date du constat quand elle existe', () => {
    const t = verifiedTitle(AT);
    expect(t).toMatch(/Vérifié en banque le/);
    expect(t).toMatch(/2026/);
    expect(t).toMatch(/cliquer pour retirer/);
  });

  it('invite à pointer le compte quand rien n’a été constaté', () => {
    expect(verifiedTitle(null)).toMatch(/compte bancaire/);
    expect(verifiedTitle(null)).toMatch(/marquer vérifié/);
  });

  it('ne rend pas « Invalid Date » sur une date illisible', () => {
    const t = verifiedTitle('pas-une-date');
    expect(t).not.toMatch(/Invalid/);
    expect(t).toMatch(/Vérifié en banque/);
  });
});

describe('Le clic', () => {
  it('demande la bascule inverse', () => {
    const onToggle = vi.fn();
    render(<DepositVerifiedToggle verifiedAt={null} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('retire la vérification quand elle est posée', () => {
    const onToggle = vi.fn();
    render(<DepositVerifiedToggle verifiedAt={AT} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("n'ouvre PAS la fiche du dépôt — la ligne entière est cliquable", () => {
    const rowClick = vi.fn();
    const onToggle = vi.fn();
    render(
      <div onClick={rowClick}>
        <DepositVerifiedToggle verifiedAt={null} onToggle={onToggle} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(rowClick).not.toHaveBeenCalled();
  });

  it('ne part pas deux fois pendant que la bascule est en vol', () => {
    const onToggle = vi.fn();
    render(<DepositVerifiedToggle verifiedAt={null} onToggle={onToggle} pending />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('Sans le droit de traiter les dépôts', () => {
  it("montre l'état, mais n'offre aucun bouton", () => {
    render(<DepositVerifiedToggle verifiedAt={AT} onToggle={vi.fn()} readOnly />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Vérifié')).toBeTruthy();
  });

  it("ne promet pas une action qu'on ne peut pas faire", () => {
    const { container } = render(<DepositVerifiedToggle verifiedAt={AT} onToggle={vi.fn()} readOnly />);
    expect(container.querySelector('[title]')?.getAttribute('title')).not.toMatch(/cliquer/);
  });
});

describe("L'état est lisible par un lecteur d'écran", () => {
  it('aria-pressed reflète la vérification', () => {
    const { rerender } = render(<DepositVerifiedToggle verifiedAt={null} onToggle={vi.fn()} />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
    rerender(<DepositVerifiedToggle verifiedAt={AT} onToggle={vi.fn()} />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });
});
