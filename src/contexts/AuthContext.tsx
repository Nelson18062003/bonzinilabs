import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  user: { email: string } | null;
  isLoading: boolean;
  signIn: (email: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for saved user
    const savedEmail = localStorage.getItem('bonzini_user_email');
    if (savedEmail) {
      setUser({ email: savedEmail });
    }
    setIsLoading(false);
  }, []);

  const signIn = (email: string) => {
    localStorage.setItem('bonzini_user_email', email);
    setUser({ email });
  };

  const signOut = () => {
    localStorage.removeItem('bonzini_user_email');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
