import { useCallback, useState } from 'react';
import { readStoredLocation, storeLocation, type ReceptionLocation } from '@/lib/reception';

/** Le lieu du réceptionnaire (entrepôt = Sea, bureau = Air), mémorisé sur l'appareil. */
export function useReceptionLocation() {
  const [location, setLocationState] = useState<ReceptionLocation | null>(() => readStoredLocation());
  const setLocation = useCallback((loc: ReceptionLocation) => {
    storeLocation(loc);
    setLocationState(loc);
  }, []);
  return { location, setLocation };
}

/** Le brouillon entre deux écrans du même dépôt : le bordereau lu au scan, avant qu'un colis existe. */
const DRAFT_KEY = 'bonzini-reception-draft';
export function readDraftWaybill(): string | null {
  try { return sessionStorage.getItem(DRAFT_KEY); } catch { return null; }
}
export function writeDraftWaybill(value: string | null): void {
  try {
    if (value) sessionStorage.setItem(DRAFT_KEY, value);
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* rien */ }
}
