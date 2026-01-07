import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAgentAuth } from '@/contexts/AgentAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AgentLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, isCashAgent } = useAgentAuth();
  const { language, setLanguage, t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast.error(t('invalid_credentials'));
        return;
      }

      // Wait a bit for the role check to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // The auth context will update and we can navigate
      navigate('/agent/payments');
    } catch (error) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex flex-col items-center justify-center p-4">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 flex rounded-lg border overflow-hidden bg-background">
        <button
          onClick={() => setLanguage('en')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            language === 'en'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          )}
        >
          EN
        </button>
        <button
          onClick={() => setLanguage('zh')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            language === 'zh'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          )}
        >
          中文
        </button>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <Banknote className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">{t('agent_login')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email_address')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@bonzini.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {t('sign_in')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
