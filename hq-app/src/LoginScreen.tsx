// ============================================================
// LA CONNEXION NATIVE — une seule pour tout le personnel.
//   1. L'adresse email (mémorisée sur le téléphone, toujours modifiable).
//   2. Code reçu par email, ou mot de passe (comptes partagés, comme celui
//      de l'entrepôt de Guangzhou).
//   3. On vérifie que la personne fait partie de l'équipe (user_roles, compte
//      non désactivé) AVANT d'ouvrir quoi que ce soit, puis la session est
//      confiée au site — qui la garde et la rafraîchit. Le site envoie
//      ensuite chacun dans son espace.
// Un nouveau client Supabase par tentative : rien ne survit à l'écran.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';
import { createClient, type Session } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { C } from './theme';

const LAST_EMAIL = 'hq-last-email';
const OTP_LENGTH = 6;
type Step = 'email' | 'method' | 'code' | 'password';

function newAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** Les messages de Supabase, en français clair. */
function frenchError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('expired') || (m.includes('invalid') && m.includes('otp'))) return 'Code incorrect ou expiré. Demandez-en un nouveau.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Trop d’essais. Patientez une minute puis réessayez.';
  if (m.includes('network') || m.includes('fetch')) return 'Pas de connexion. Vérifiez le réseau.';
  return message;
}

interface Props {
  /** La session prête (membre de l'équipe vérifié) : l'écran principal la confie au site. */
  onSession: (session: Session) => void;
  /** Le site n'a pas confirmé la connexion : message à afficher. */
  error?: string | null;
  busy?: boolean;
}

export function LoginScreen({ onSession, error: outerError, busy: outerBusy }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const client = useRef(newAuthClient());

  useEffect(() => {
    void SecureStore.getItemAsync(LAST_EMAIL).then((v) => { if (v) setEmail(v); }).catch(() => {});
  }, []);
  useEffect(() => { if (outerError) setError(outerError); }, [outerError]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const go = (s: Step) => { setError(null); setStep(s); };

  /** Membre de l'équipe ? Puis on remet la session à l'écran principal. */
  const finish = async (session: Session) => {
    const { data, error: roleError } = await client.current
      .from('user_roles')
      .select('role, is_disabled')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!data) throw new Error('Ce compte n’a pas accès à l’app de l’équipe.');
    if (data.is_disabled) throw new Error('Ce compte a été désactivé. Contactez un administrateur.');
    await SecureStore.setItemAsync(LAST_EMAIL, email.trim().toLowerCase()).catch(() => {});
    onSession(session);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(frenchError(e instanceof Error ? e.message : String(e)));
      client.current = newAuthClient();
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => run(async () => {
    const { error: e } = await client.current.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
    // Adresse inconnue : même écran suivant (pas d'énumération des comptes), comme sur le site.
    if (e && !/not found|no user|signups not allowed/i.test(e.message)) throw e;
    setCooldown(30);
    setCode('');
    go('code');
  });

  const verifyCode = (value: string) => run(async () => {
    const { data, error: e } = await client.current.auth.verifyOtp({ email: email.trim().toLowerCase(), token: value.trim(), type: 'email' });
    if (e) throw e;
    if (!data.session) throw new Error('Code incorrect ou expiré.');
    await finish(data.session);
  });

  const signInWithPassword = () => run(async () => {
    const { data, error: e } = await client.current.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (e) throw e;
    if (!data.session) throw new Error('Connexion impossible.');
    await finish(data.session);
  });

  const loading = busy || !!outerBusy;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {step !== 'email' && (
              <Pressable onPress={() => go(step === 'method' ? 'email' : 'method')} style={styles.back} accessibilityLabel="Retour" hitSlop={12}>
                <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
              </Pressable>
            )}
            <Image source={require('../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />

            {step === 'email' && (
              <View style={styles.block}>
                <Text style={styles.title}>Bienvenue</Text>
                <Text style={styles.hint}>L’app de l’équipe Bonzini. Entrez votre adresse email.</Text>
                <TextInput
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(null); }}
                  placeholder="prenom@bonzinilabs.com"
                  placeholderTextColor="#8B8398"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => emailOk && go('method')}
                  style={styles.input}
                />
                <Primary label="Continuer" disabled={!emailOk} onPress={() => go('method')} />
              </View>
            )}

            {step === 'method' && (
              <View style={styles.block}>
                <Text style={styles.title}>Comment vous connecter ?</Text>
                <Pressable onPress={() => go('email')}><Text style={styles.email}>{email.trim()}  <Ionicons name="pencil" size={14} color="#D6D0E0" /></Text></Pressable>
                <Method icon="mail" title="Recevoir un code par email" hint="6 chiffres, tout de suite" onPress={sendCode} loading={loading} primary />
                <Method icon="key" title="Mot de passe" hint="Celui qui vous a été donné avec votre compte" onPress={() => { setPassword(''); go('password'); }} />
              </View>
            )}

            {step === 'code' && (
              <View style={styles.block}>
                <Text style={styles.title}>Entrez le code</Text>
                <Text style={styles.hint}>Envoyé à {email.trim()}</Text>
                <TextInput
                  value={code}
                  onChangeText={(v) => {
                    const digits = v.replace(/\D/g, '').slice(0, OTP_LENGTH);
                    setCode(digits);
                    setError(null);
                    if (digits.length === OTP_LENGTH) void verifyCode(digits);
                  }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={OTP_LENGTH}
                  autoFocus
                  style={[styles.input, styles.code]}
                  placeholder="• • • • • •"
                  placeholderTextColor="#8B8398"
                />
                <Primary label="Valider" disabled={code.length !== OTP_LENGTH} loading={loading} onPress={() => void verifyCode(code)} />
                <Pressable disabled={cooldown > 0 || loading} onPress={sendCode} style={styles.link}>
                  <Text style={[styles.linkText, cooldown > 0 && { opacity: 0.5 }]}>{cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : 'Renvoyer le code'}</Text>
                </Pressable>
              </View>
            )}

            {step === 'password' && (
              <View style={styles.block}>
                <Text style={styles.title}>Votre mot de passe</Text>
                <Text style={styles.hint}>{email.trim()}</Text>
                <TextInput
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(null); }}
                  secureTextEntry
                  textContentType="password"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={() => password && void signInWithPassword()}
                  style={styles.input}
                  placeholder="Mot de passe"
                  placeholderTextColor="#8B8398"
                />
                <Primary label="Se connecter" disabled={!password} loading={loading} onPress={() => void signInWithPassword()} />
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Primary({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.primary, (disabled || loading) && { opacity: 0.45 }, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      {loading ? <ActivityIndicator color={C.ink} /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

function Method({ icon, title, hint, onPress, primary, loading }: { icon: 'mail' | 'key'; title: string; hint: string; onPress: () => void; primary?: boolean; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => [styles.method, primary && styles.methodPrimary, pressed && { opacity: 0.88 }]} accessibilityRole="button">
      <View style={[styles.methodIcon, primary && { backgroundColor: 'rgba(26,16,40,0.08)' }]}>
        {loading && primary ? <ActivityIndicator color={C.ink} /> : <Ionicons name={icon} size={22} color={primary ? C.ink : '#FFFFFF'} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.methodTitle, primary && { color: C.ink }]}>{title}</Text>
        <Text style={[styles.methodHint, primary && { color: '#5F5775' }]}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={primary ? C.ink : '#D6D0E0'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.ink },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 48 },
  back: { position: 'absolute', top: 8, left: 8, padding: 8, zIndex: 2 },
  logo: { width: 140, height: 140, alignSelf: 'center', marginBottom: 12 },
  block: { gap: 14 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  hint: { color: '#D6D0E0', fontSize: 16, textAlign: 'center', marginBottom: 6 },
  email: { color: '#D6D0E0', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 14, height: 58, paddingHorizontal: 18, fontSize: 18, color: C.text },
  code: { textAlign: 'center', fontSize: 28, letterSpacing: 10, fontWeight: '700' },
  primary: { backgroundColor: '#FFFFFF', borderRadius: 999, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: C.ink, fontSize: 18, fontWeight: '800' },
  method: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  methodPrimary: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  methodIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  methodTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  methodHint: { color: '#D6D0E0', fontSize: 14, marginTop: 2 },
  link: { alignSelf: 'center', padding: 10 },
  linkText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  error: { color: '#FFB4AB', fontSize: 16, textAlign: 'center', marginTop: 18, fontWeight: '600' },
});
