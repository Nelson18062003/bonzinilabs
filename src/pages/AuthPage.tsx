import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Email invalide');

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sendOtp, verifyOtp, isLoading: authLoading, user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');

  // Redirect if already logged in
  if (user) {
    const from = (location.state as { from?: string })?.from || '/';
    navigate(from, { replace: true });
    return null;
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    const { error } = await sendOtp(email);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Code envoyé ! Vérifiez votre boîte mail.');
    setStep('otp');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpCode.length !== 6) {
      toast.error('Veuillez entrer le code à 6 chiffres');
      return;
    }

    setIsLoading(true);
    const { error } = await verifyOtp(email, otpCode);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Token has expired')) {
        toast.error('Le code a expiré. Demandez un nouveau code.');
      } else if (error.message.includes('Invalid')) {
        toast.error('Code invalide. Vérifiez et réessayez.');
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success('Connexion réussie !');
    navigate('/');
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    const { error } = await sendOtp(email);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Nouveau code envoyé !');
    setOtpCode('');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-primary">B</span>
          </div>
          <CardTitle className="text-2xl font-bold">Bonzini</CardTitle>
          <CardDescription>
            {step === 'email' 
              ? 'Entrez votre email pour recevoir un code de connexion'
              : `Code envoyé à ${email}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Recevoir le code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="space-y-4">
                <Label className="text-center block">Entrez le code à 6 chiffres</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={(value) => setOtpCode(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading || otpCode.length !== 6}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Se connecter
              </Button>
              
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={handleResendCode}
                  disabled={isLoading}
                >
                  Renvoyer le code
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => {
                    setStep('email');
                    setOtpCode('');
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Changer d'email
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
