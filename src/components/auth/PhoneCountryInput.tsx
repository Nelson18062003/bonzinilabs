import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Country {
  name: string;
  flag: string;
  dialCode: string;
}

const COUNTRIES: Country[] = [
  { name: 'Cameroun', flag: '🇨🇲', dialCode: '237' },
  { name: 'Congo', flag: '🇨🇬', dialCode: '242' },
  { name: 'RD Congo', flag: '🇨🇩', dialCode: '243' },
  { name: 'Gabon', flag: '🇬🇦', dialCode: '241' },
  { name: "Côte d'Ivoire", flag: '🇨🇮', dialCode: '225' },
  { name: 'Sénégal', flag: '🇸🇳', dialCode: '221' },
  { name: 'Mali', flag: '🇲🇱', dialCode: '223' },
  { name: 'Burkina Faso', flag: '🇧🇫', dialCode: '226' },
  { name: 'Niger', flag: '🇳🇪', dialCode: '227' },
  { name: 'Togo', flag: '🇹🇬', dialCode: '228' },
  { name: 'Bénin', flag: '🇧🇯', dialCode: '229' },
  { name: 'Guinée', flag: '🇬🇳', dialCode: '224' },
  { name: 'Ghana', flag: '🇬🇭', dialCode: '233' },
  { name: 'Maroc', flag: '🇲🇦', dialCode: '212' },
  { name: 'Algérie', flag: '🇩🇿', dialCode: '213' },
  { name: 'Tunisie', flag: '🇹🇳', dialCode: '216' },
  { name: 'Cap-Vert', flag: '🇨🇻', dialCode: '238' },
  { name: 'France', flag: '🇫🇷', dialCode: '33' },
  { name: 'Belgique', flag: '🇧🇪', dialCode: '32' },
  { name: 'Suisse', flag: '🇨🇭', dialCode: '41' },
  { name: 'Allemagne', flag: '🇩🇪', dialCode: '49' },
  { name: 'Royaume-Uni', flag: '🇬🇧', dialCode: '44' },
  { name: 'Italie', flag: '🇮🇹', dialCode: '39' },
  { name: 'Espagne', flag: '🇪🇸', dialCode: '34' },
  { name: 'Portugal', flag: '🇵🇹', dialCode: '351' },
  { name: 'Pologne', flag: '🇵🇱', dialCode: '48' },
  { name: 'Roumanie', flag: '🇷🇴', dialCode: '40' },
  { name: 'Chine', flag: '🇨🇳', dialCode: '86' },
  { name: 'USA', flag: '🇺🇸', dialCode: '1' },
  { name: 'Canada', flag: '🇨🇦', dialCode: '1' },
  { name: 'Brésil', flag: '🇧🇷', dialCode: '55' },
];

interface PhoneCountryInputProps {
  value: string;
  onChange: (val: string) => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function PhoneCountryInput({
  value,
  onChange,
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
        setLocalNumber(value.slice(matched.dialCode.length + 1));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const digits = localNumber.replace(/\D/g, '');
    onChange('+' + country.dialCode + digits);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalNumber(raw);
    const digits = raw.replace(/\D/g, '');
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
        Téléphone *
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
          placeholder="Ex: 6 12 34 56 78"
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
              <p className="text-sm text-muted-foreground text-center py-4">Aucun résultat</p>
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
