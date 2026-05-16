export interface CountryCode {
  code: string;
  country: string;
  flag: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  // ─── CEMAC (en premier) ───
  { code: '+237', country: 'Cameroun', flag: '🇨🇲' },
  { code: '+241', country: 'Gabon', flag: '🇬🇦' },
  { code: '+235', country: 'Tchad', flag: '🇹🇩' },
  { code: '+236', country: 'RCA', flag: '🇨🇫' },
  { code: '+242', country: 'Congo', flag: '🇨🇬' },
  { code: '+240', country: 'Guinée équatoriale', flag: '🇬🇶' },
  // ─── Chine (cible business) ───
  { code: '+86', country: 'Chine', flag: '🇨🇳' },
  // ─── Afrique de l'Ouest ───
  { code: '+225', country: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: '+221', country: 'Sénégal', flag: '🇸🇳' },
  { code: '+223', country: 'Mali', flag: '🇲🇱' },
  { code: '+226', country: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+228', country: 'Togo', flag: '🇹🇬' },
  { code: '+229', country: 'Bénin', flag: '🇧🇯' },
  { code: '+227', country: 'Niger', flag: '🇳🇪' },
  { code: '+224', country: 'Guinée', flag: '🇬🇳' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  // ─── Afrique Centrale & Est ───
  { code: '+243', country: 'RD Congo', flag: '🇨🇩' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
  { code: '+257', country: 'Burundi', flag: '🇧🇮' },
  { code: '+244', country: 'Angola', flag: '🇦🇴' },
  // ─── Afrique du Nord ───
  { code: '+212', country: 'Maroc', flag: '🇲🇦' },
  { code: '+216', country: 'Tunisie', flag: '🇹🇳' },
  { code: '+213', country: 'Algérie', flag: '🇩🇿' },
  // ─── Reste de l'Afrique ───
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+255', country: 'Tanzanie', flag: '🇹🇿' },
  { code: '+256', country: 'Ouganda', flag: '🇺🇬' },
  { code: '+251', country: 'Éthiopie', flag: '🇪🇹' },
  { code: '+27', country: 'Afrique du Sud', flag: '🇿🇦' },
  // ─── Europe ───
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+32', country: 'Belgique', flag: '🇧🇪' },
  { code: '+41', country: 'Suisse', flag: '🇨🇭' },
  { code: '+44', country: 'Royaume-Uni', flag: '🇬🇧' },
  { code: '+49', country: 'Allemagne', flag: '🇩🇪' },
  { code: '+34', country: 'Espagne', flag: '🇪🇸' },
  { code: '+39', country: 'Italie', flag: '🇮🇹' },
  { code: '+352', country: 'Luxembourg', flag: '🇱🇺' },
  // ─── Amérique ───
  { code: '+1', country: 'États-Unis / Canada', flag: '🇺🇸' },
  // ─── Asie ───
  { code: '+971', country: 'Émirats arabes unis', flag: '🇦🇪' },
  { code: '+966', country: 'Arabie saoudite', flag: '🇸🇦' },
  { code: '+90', country: 'Turquie', flag: '🇹🇷' },
  { code: '+91', country: 'Inde', flag: '🇮🇳' },
];

/**
 * Splits an E.164-ish phone number "+237691234567" into dial code
 * and the local number "691234567". Falls back to the default
 * dial code when the value doesn't start with a recognised prefix.
 */
export function splitPhone(value: string | null | undefined, defaultDialCode = '+237'): { dialCode: string; local: string } {
  if (!value) return { dialCode: defaultDialCode, local: '' };
  // Sort by length desc so "+237" matches before "+2".
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (value.startsWith(c.code)) {
      return { dialCode: c.code, local: value.slice(c.code.length).replace(/\D/g, '') };
    }
  }
  // Best-effort: assume default + numeric part.
  return { dialCode: defaultDialCode, local: value.replace(/\D/g, '') };
}

/**
 * Combines dial code + local number into the canonical "+237691234567" form,
 * stripping spaces and non-digits from the local portion.
 */
export function joinPhone(dialCode: string, local: string): string | null {
  const cleaned = local.replace(/\D/g, '');
  if (!cleaned) return null;
  return `${dialCode}${cleaned}`;
}

/**
 * Pretty-prints a phone number: "+237 691 23 45 67".
 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  const { dialCode, local } = splitPhone(value);
  // Group by 3,2,2,2 for typical African / Chinese length, fallback to chunks of 3.
  const groups: string[] = [];
  let s = local;
  if (local.length === 9) {
    groups.push(s.slice(0, 3), s.slice(3, 5), s.slice(5, 7), s.slice(7, 9));
  } else if (local.length === 10) {
    groups.push(s.slice(0, 2), s.slice(2, 4), s.slice(4, 6), s.slice(6, 8), s.slice(8, 10));
  } else {
    while (s.length > 0) {
      groups.push(s.slice(0, 3));
      s = s.slice(3);
    }
  }
  return `${dialCode} ${groups.join(' ')}`.trim();
}
