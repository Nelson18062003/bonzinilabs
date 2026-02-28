import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Country {
  name: string;
  flag: string;
  dialCode: string;
  phoneFormat: string;
  maxDigits: number;
}

export const COUNTRIES: Country[] = [
  // Afrique
  { name: 'Cameroun', flag: '\u{1F1E8}\u{1F1F2}', dialCode: '237', phoneFormat: '# ## ## ## ##', maxDigits: 9 },
  { name: 'Congo', flag: '\u{1F1E8}\u{1F1EC}', dialCode: '242', phoneFormat: '## ### ####', maxDigits: 9 },
  { name: 'RD Congo', flag: '\u{1F1E8}\u{1F1E9}', dialCode: '243', phoneFormat: '### ### ###', maxDigits: 9 },
  { name: 'Gabon', flag: '\u{1F1EC}\u{1F1E6}', dialCode: '241', phoneFormat: '# ## ## ##', maxDigits: 7 },
  { name: "C\u00f4te d'Ivoire", flag: '\u{1F1E8}\u{1F1EE}', dialCode: '225', phoneFormat: '## ## ## ## ##', maxDigits: 10 },
  { name: 'S\u00e9n\u00e9gal', flag: '\u{1F1F8}\u{1F1F3}', dialCode: '221', phoneFormat: '## ### ## ##', maxDigits: 9 },
  { name: 'Mali', flag: '\u{1F1F2}\u{1F1F1}', dialCode: '223', phoneFormat: '## ## ## ##', maxDigits: 8 },
  { name: 'Burkina Faso', flag: '\u{1F1E7}\u{1F1EB}', dialCode: '226', phoneFormat: '## ## ## ##', maxDigits: 8 },
  { name: 'Niger', flag: '\u{1F1F3}\u{1F1EA}', dialCode: '227', phoneFormat: '## ## ## ##', maxDigits: 8 },
  { name: 'Togo', flag: '\u{1F1F9}\u{1F1EC}', dialCode: '228', phoneFormat: '## ## ## ##', maxDigits: 8 },
  { name: 'B\u00e9nin', flag: '\u{1F1E7}\u{1F1EF}', dialCode: '229', phoneFormat: '## ## ## ##', maxDigits: 8 },
  { name: 'Guin\u00e9e', flag: '\u{1F1EC}\u{1F1F3}', dialCode: '224', phoneFormat: '### ## ## ##', maxDigits: 9 },
  { name: 'Ghana', flag: '\u{1F1EC}\u{1F1ED}', dialCode: '233', phoneFormat: '## ### ####', maxDigits: 9 },
  { name: 'Maroc', flag: '\u{1F1F2}\u{1F1E6}', dialCode: '212', phoneFormat: '# ## ## ## ##', maxDigits: 9 },
  { name: 'Alg\u00e9rie', flag: '\u{1F1E9}\u{1F1FF}', dialCode: '213', phoneFormat: '### ## ## ##', maxDigits: 9 },
  { name: 'Tunisie', flag: '\u{1F1F9}\u{1F1F3}', dialCode: '216', phoneFormat: '## ### ###', maxDigits: 8 },
  { name: 'Cap-Vert', flag: '\u{1F1E8}\u{1F1FB}', dialCode: '238', phoneFormat: '### ## ##', maxDigits: 7 },
  // Europe
  { name: 'France', flag: '\u{1F1EB}\u{1F1F7}', dialCode: '33', phoneFormat: '# ## ## ## ##', maxDigits: 9 },
  { name: 'Belgique', flag: '\u{1F1E7}\u{1F1EA}', dialCode: '32', phoneFormat: '### ## ## ##', maxDigits: 9 },
  { name: 'Suisse', flag: '\u{1F1E8}\u{1F1ED}', dialCode: '41', phoneFormat: '## ### ## ##', maxDigits: 9 },
  { name: 'Allemagne', flag: '\u{1F1E9}\u{1F1EA}', dialCode: '49', phoneFormat: '### ### ####', maxDigits: 10 },
  { name: 'Royaume-Uni', flag: '\u{1F1EC}\u{1F1E7}', dialCode: '44', phoneFormat: '#### ### ###', maxDigits: 10 },
  { name: 'Italie', flag: '\u{1F1EE}\u{1F1F9}', dialCode: '39', phoneFormat: '### ### ####', maxDigits: 10 },
  { name: 'Espagne', flag: '\u{1F1EA}\u{1F1F8}', dialCode: '34', phoneFormat: '### ## ## ##', maxDigits: 9 },
  { name: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}', dialCode: '351', phoneFormat: '### ### ###', maxDigits: 9 },
  { name: 'Pologne', flag: '\u{1F1F5}\u{1F1F1}', dialCode: '48', phoneFormat: '### ### ###', maxDigits: 9 },
  { name: 'Roumanie', flag: '\u{1F1F7}\u{1F1F4}', dialCode: '40', phoneFormat: '### ### ###', maxDigits: 9 },
  // Autres
  { name: 'Chine', flag: '\u{1F1E8}\u{1F1F3}', dialCode: '86', phoneFormat: '### #### ####', maxDigits: 11 },
  { name: 'USA', flag: '\u{1F1FA}\u{1F1F8}', dialCode: '1', phoneFormat: '### ### ####', maxDigits: 10 },
  { name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', dialCode: '1', phoneFormat: '### ### ####', maxDigits: 10 },
  { name: 'Br\u00e9sil', flag: '\u{1F1E7}\u{1F1F7}', dialCode: '55', phoneFormat: '## ##### ####', maxDigits: 11 },
];

function formatPhoneDisplay(digits: string, format: string): string {
  if (!digits) return '';
  let result = '';
  let digitIndex = 0;
  for (let i = 0; i < format.length && digitIndex < digits.length; i++) {
    if (format[i] === '#') {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += format[i];
      // If the next format char is # and we still have digits, continue
      // Otherwise we added a space at the end, which is fine
    }
  }
  return result;
}

function getPlaceholder(format: string): string {
  let digit = 1;
  let result = '';
  for (const ch of format) {
    if (ch === '#') {
      result += String(digit % 10);
      digit++;
    } else {
      result += ch;
    }
  }
  return result;
}

interface PhoneCountryInputProps {
  value: string;
  onChange: (val: string) => void;
  selectedCountryName?: string;
  onCountryChange?: (country: Country) => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function PhoneCountryInput({
  value,
  onChange,
  selectedCountryName,
  onCountryChange,
  error,
  disabled,
  autoFocus,
}: PhoneCountryInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [localNumber, setLocalNumber] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync localNumber from external value on first load
  useEffect(() => {
    if (value && value.startsWith('+')) {
      const matched = COUNTRIES.find(c => value.startsWith('+' + c.dialCode));
      if (matched) {
        setSelectedCountry(matched);
        const rawDigits = value.slice(matched.dialCode.length + 1);
        setLocalNumber(formatPhoneDisplay(rawDigits, matched.phoneFormat));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync country from external selectedCountryName prop
  useEffect(() => {
    if (selectedCountryName) {
      const matched = COUNTRIES.find(c => c.name === selectedCountryName);
      if (matched && matched.name !== selectedCountry.name) {
        setSelectedCountry(matched);
        const digits = localNumber.replace(/\D/g, '');
        const truncated = digits.slice(0, matched.maxDigits);
        const formatted = formatPhoneDisplay(truncated, matched.phoneFormat);
        setLocalNumber(formatted);
        onChange('+' + matched.dialCode + truncated);
      }
    }
  }, [selectedCountryName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearch('');
    const digits = localNumber.replace(/\D/g, '').slice(0, country.maxDigits);
    const formatted = formatPhoneDisplay(digits, country.phoneFormat);
    setLocalNumber(formatted);
    onChange('+' + country.dialCode + digits);
    onCountryChange?.(country);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, selectedCountry.maxDigits);
    const formatted = formatPhoneDisplay(digits, selectedCountry.phoneFormat);
    setLocalNumber(formatted);
    onChange('+' + selectedCountry.dialCode + digits);
  };

  const filtered = search.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search)
      )
    : COUNTRIES;

  const isFocused = isOpen;
  const hasError = !!error;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Label */}
      <label className="block text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-2">
        <Phone className="w-4 h-4" />
        T\u00e9l\u00e9phone *
      </label>

      {/* Input container */}
      <div
        className={cn(
          'flex items-center rounded-xl border bg-card transition-all',
          isFocused ? 'border-primary ring-2 ring-primary/20' : 'border-border',
          hasError ? 'border-destructive ring-2 ring-destructive/20' : '',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        )}
      >
        {/* Country code button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-3 border-r border-border text-sm font-medium whitespace-nowrap hover:bg-muted/40 transition-colors rounded-l-xl flex-shrink-0"
        >
          <span className="text-base">{selectedCountry.flag}</span>
          <span className="text-foreground">+{selectedCountry.dialCode}</span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
        </button>

        {/* Phone number input */}
        <input
          type="tel"
          value={localNumber}
          onChange={handleNumberChange}
          onFocus={() => !isOpen && undefined}
          placeholder={`Ex: ${getPlaceholder(selectedCountry.phoneFormat)}`}
          disabled={disabled}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un pays..."
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Country list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun r\u00e9sultat</p>
            ) : (
              filtered.map(country => (
                <button
                  key={`${country.dialCode}-${country.name}`}
                  type="button"
                  onClick={() => handleCountrySelect(country)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-muted/40 transition-colors',
                    selectedCountry.name === country.name && 'bg-primary/10 text-primary font-medium',
                  )}
                >
                  <span className="text-base">{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                  <span className="text-muted-foreground text-xs">+{country.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
