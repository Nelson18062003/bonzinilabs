import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Loader2, 
  Search,
  Building2,
  Store,
  Smartphone,
  Waves,
  MapPin,
  Upload,
  X,
  FileImage,
  User,
  CalendarIcon,
} from 'lucide-react';
import { useAllClients, useAdminCreateDeposit } from '@/hooks/useAdminCreateDeposit';
import { DepositMethod } from '@/hooks/useDeposits';
import { 
  methodFamilies, 
  getSubMethodsForFamily,
  banks,
  agencies,
  familyRequiresSubMethod,
  subMethodRequiresBankSelection,
} from '@/data/depositMethodsData';
import { 
  DepositMethodFamily, 
  DepositSubMethod, 
  BankOption, 
  AgencyOption 
} from '@/types/deposit';
import { formatXAF } from '@/lib/formatters';
import { cn } from '@/lib/utils';

type Step = 'client' | 'date' | 'amount' | 'method' | 'submethod' | 'bank' | 'agency' | 'proofs' | 'summary';

const STEP_LABELS: Record<Step, string> = {
  client: 'Client',
  date: 'Date',
  amount: 'Montant',
  method: 'Méthode',
  submethod: 'Type',
  bank: 'Banque',
  agency: 'Agence',
  proofs: 'Preuves',
  summary: 'Récap',
};

const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Store,
  Smartphone,
  Waves,
};

export function AdminNewDepositPage() {
  const navigate = useNavigate();
  const { data: clients, isLoading: clientsLoading } = useAllClients();
  const createDeposit = useAdminCreateDeposit();

  // Form state
  const [step, setStep] = useState<Step>('client');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<typeof clients[0] | null>(null);
  const [depositDate, setDepositDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<DepositMethodFamily | null>(null);
  const [selectedSubMethod, setSelectedSubMethod] = useState<DepositSubMethod | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencyOption | null>(null);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [adminComment, setAdminComment] = useState('');

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients.slice(0, 10);
    
    const search = clientSearch.toLowerCase();
    return clients.filter(c => 
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
      c.phone?.includes(search)
    ).slice(0, 10);
  }, [clients, clientSearch]);

  // Get deposit method for DB
  const getDepositMethod = (): DepositMethod => {
    if (selectedFamily === 'BANK') {
      return selectedSubMethod === 'BANK_TRANSFER' ? 'bank_transfer' : 'bank_cash';
    }
    if (selectedFamily === 'ORANGE_MONEY') {
      return selectedSubMethod === 'OM_TRANSFER' ? 'om_transfer' : 'om_withdrawal';
    }
    if (selectedFamily === 'MTN_MONEY') {
      return selectedSubMethod === 'MTN_TRANSFER' ? 'mtn_transfer' : 'mtn_withdrawal';
    }
    if (selectedFamily === 'AGENCY_BONZINI') return 'agency_cash';
    if (selectedFamily === 'WAVE') return 'wave';
    return 'bank_transfer';
  };

  // Handle family selection
  const handleFamilySelected = (family: DepositMethodFamily) => {
    setSelectedFamily(family);
    
    if (familyRequiresSubMethod(family)) {
      setStep('submethod');
    } else if (family === 'AGENCY_BONZINI') {
      setSelectedSubMethod('AGENCY_CASH');
      setStep('agency');
    } else if (family === 'WAVE') {
      setSelectedSubMethod('WAVE_TRANSFER');
      setStep('proofs');
    }
  };

  // Handle sub-method selection
  const handleSubMethodSelected = (subMethod: DepositSubMethod) => {
    setSelectedSubMethod(subMethod);
    
    if (subMethodRequiresBankSelection(subMethod)) {
      setStep('bank');
    } else {
      setStep('proofs');
    }
  };

  // Handle bank selection
  const handleBankSelected = (bank: BankOption) => {
    setSelectedBank(bank);
    setStep('proofs');
  };

  // Handle agency selection
  const handleAgencySelected = (agency: AgencyOption) => {
    setSelectedAgency(agency);
    setStep('proofs');
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setProofFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setProofFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Submit
  const handleSubmit = async () => {
    if (!selectedClient) return;
    
    await createDeposit.mutateAsync({
      user_id: selectedClient.user_id,
      amount_xaf: parseInt(amount),
      method: getDepositMethod(),
      bank_name: selectedBank || undefined,
      agency_name: selectedAgency || undefined,
      admin_comment: adminComment || undefined,
      proofFiles: proofFiles.length > 0 ? proofFiles : undefined,
      deposit_date: !isToday(depositDate) ? depositDate : undefined,
    });

    navigate('/admin/deposits');
  };

  // Progress calculation
  const steps: Step[] = ['client', 'date', 'amount', 'method'];
  if (familyRequiresSubMethod(selectedFamily!)) steps.push('submethod');
  if (selectedFamily === 'BANK') steps.push('bank');
  if (selectedFamily === 'AGENCY_BONZINI') steps.push('agency');
  steps.push('proofs', 'summary');
  
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Back navigation
  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    } else {
      navigate('/admin/deposits');
    }
  };

  // Render step content
  const renderContent = () => {
    switch (step) {
      case 'client':
        return (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client (nom, téléphone)..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {clientsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClient(client);
                      setStep('date');
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                      'hover:border-primary/50 hover:bg-primary/5',
                      selectedClient?.id === client.id && 'border-primary bg-primary/10'
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {client.first_name[0]}{client.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{client.first_name} {client.last_name}</p>
                      {client.phone && (
                        <p className="text-sm text-muted-foreground">{client.phone}</p>
                      )}
                    </div>
                    {selectedClient?.id === client.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}

                {filteredClients.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun client trouvé
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case 'date':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Date du dépôt
              </p>
              
              <div className="flex justify-center gap-2 mb-4">
                <Button
                  variant={isToday(depositDate) ? 'default' : 'outline'}
                  onClick={() => setDepositDate(new Date())}
                >
                  Aujourd'hui
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={!isToday(depositDate) ? 'default' : 'outline'}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {!isToday(depositDate) 
                        ? format(depositDate, 'dd MMM yyyy', { locale: fr })
                        : 'Autre date'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={depositDate}
                      onSelect={(date) => date && setDepositDate(date)}
                      locale={fr}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {!isToday(depositDate) && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <CalendarIcon className="inline h-4 w-4 mr-1" />
                  Date sélectionnée : <strong>{format(depositDate, 'EEEE dd MMMM yyyy', { locale: fr })}</strong>
                </div>
              )}
            </div>

            <Button onClick={() => setStep('amount')} className="w-full">
              Continuer <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );

      case 'amount':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Montant à déposer</p>
              <div className="flex items-center justify-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  className="text-4xl font-bold text-center bg-transparent border-none outline-none w-48"
                  autoFocus
                />
                <span className="text-2xl text-muted-foreground">XAF</span>
              </div>
              {amount && (
                <p className="text-muted-foreground mt-2">
                  {formatXAF(parseInt(amount) || 0)} XAF
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[100000, 500000, 1000000].map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  onClick={() => setAmount(preset.toString())}
                >
                  {formatXAF(preset)}
                </Button>
              ))}
            </div>

            <Button
              onClick={() => setStep('method')}
              disabled={!amount || parseInt(amount) < 1000}
              className="w-full"
            >
              Continuer <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );

      case 'method':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Méthode de dépôt
            </p>
            {methodFamilies.map((family) => {
              const IconComponent = METHOD_ICONS[family.icon] || Building2;
              const isSelected = selectedFamily === family.family;
              
              return (
                <button
                  key={family.family}
                  onClick={() => handleFamilySelected(family.family)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-lg border transition-all',
                    'hover:border-primary/50 hover:bg-primary/5',
                    isSelected && 'border-primary bg-primary/10'
                  )}
                >
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                  )}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold">{family.label}</p>
                    <p className="text-sm text-muted-foreground">{family.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        );

      case 'submethod':
        if (!selectedFamily) return null;
        const subMethodsList = getSubMethodsForFamily(selectedFamily);
        
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Type d'opération
            </p>
            {subMethodsList.map((subMethod) => (
              <button
                key={subMethod.subMethod}
                onClick={() => handleSubMethodSelected(subMethod.subMethod)}
                className="w-full flex items-center gap-4 p-4 rounded-lg border transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex-1 text-left">
                  <p className="font-semibold">{subMethod.label}</p>
                  <p className="text-sm text-muted-foreground">{subMethod.description}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        );

      case 'bank':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Banque utilisée
            </p>
            {banks.map((bank) => (
              <button
                key={bank.bank}
                onClick={() => handleBankSelected(bank.bank)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg border transition-all',
                  'hover:border-primary/50 hover:bg-primary/5',
                  selectedBank === bank.bank && 'border-primary bg-primary/10'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">{bank.label}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        );

      case 'agency':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Agence de dépôt
            </p>
            {agencies.map((agency) => (
              <button
                key={agency.agency}
                onClick={() => handleAgencySelected(agency.agency)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg border transition-all',
                  'hover:border-primary/50 hover:bg-primary/5',
                  selectedAgency === agency.agency && 'border-primary bg-primary/10'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">{agency.label}</p>
                  <p className="text-sm text-muted-foreground">{agency.address}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        );

      case 'proofs':
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Ajoutez les preuves de dépôt (optionnel)
              </p>

              {/* Uploaded files */}
              {proofFiles.length > 0 && (
                <div className="space-y-2 mb-4">
                  {proofFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg"
                    >
                      <FileImage className="h-5 w-5 text-primary" />
                      <span className="flex-1 text-sm truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Cliquez pour ajouter des fichiers
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleFileChange}
                />
              </label>
            </div>

            <Textarea
              placeholder="Commentaire interne (optionnel)..."
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              className="min-h-20"
            />

            <Button onClick={() => setStep('summary')} className="w-full">
              Continuer <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );

      case 'summary':
        return (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Client */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedClient?.first_name[0]}{selectedClient?.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">
                      {selectedClient?.first_name} {selectedClient?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedClient?.phone || 'Pas de téléphone'}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  {/* Date */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date du dépôt</span>
                    <span className={cn(!isToday(depositDate) && "text-amber-600 font-medium")}>
                      {isToday(depositDate) 
                        ? "Aujourd'hui" 
                        : format(depositDate, 'dd MMM yyyy', { locale: fr })
                      }
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="font-bold text-lg">{formatXAF(parseInt(amount))} XAF</span>
                  </div>

                  {/* Method */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Méthode</span>
                    <span>{methodFamilies.find(m => m.family === selectedFamily)?.label}</span>
                  </div>

                  {/* Bank */}
                  {selectedBank && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Banque</span>
                      <span>{banks.find(b => b.bank === selectedBank)?.label}</span>
                    </div>
                  )}

                  {/* Agency */}
                  {selectedAgency && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Agence</span>
                      <span>{agencies.find(a => a.agency === selectedAgency)?.label}</span>
                    </div>
                  )}

                  {/* Proofs */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preuves</span>
                    <Badge variant={proofFiles.length > 0 ? 'default' : 'secondary'}>
                      {proofFiles.length} fichier(s)
                    </Badge>
                  </div>

                  {/* Comment */}
                  {adminComment && (
                    <div>
                      <span className="text-muted-foreground text-sm">Commentaire:</span>
                      <p className="text-sm mt-1 p-2 bg-secondary/50 rounded">
                        {adminComment}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmit}
              disabled={createDeposit.isPending}
              className="w-full"
            >
              {createDeposit.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Créer le dépôt
                </>
              )}
            </Button>
          </div>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Déclarer un dépôt</h1>
            <p className="text-sm text-muted-foreground">
              {STEP_LABELS[step]}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-secondary rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Selected client summary (if selected) */}
        {selectedClient && step !== 'client' && step !== 'summary' && (
          <Card className="mb-6">
            <CardContent className="p-3 flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {selectedClient.first_name[0]}{selectedClient.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {selectedClient.first_name} {selectedClient.last_name}
                </p>
              </div>
              {amount && parseInt(amount) > 0 && (
                <Badge variant="secondary">
                  {formatXAF(parseInt(amount))} XAF
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step content */}
        <Card>
          <CardContent className="p-6">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
