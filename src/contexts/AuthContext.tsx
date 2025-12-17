import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DevUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: DevUser | null;
  isLoading: boolean;
  signIn: (email: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate a consistent UUID from email for development
function generateDevUserId(email: string): string {
  // Create a simple hash-based UUID for development
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
  return `dev-${hashStr}-${hashStr.split('').reverse().join('')}-4000-8000-${hashStr}${hashStr}`.substring(0, 36);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DevUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for saved user
    const savedUser = localStorage.getItem('bonzini_dev_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('bonzini_dev_user');
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = (email: string) => {
    const devUser: DevUser = {
      id: generateDevUserId(email),
      email,
    };
    localStorage.setItem('bonzini_dev_user', JSON.stringify(devUser));
    setUser(devUser);
  };

  const signOut = () => {
    localStorage.removeItem('bonzini_dev_user');
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

// Helper to get current dev user (for hooks that need user ID)
export function getDevUser(): DevUser | null {
  const savedUser = localStorage.getItem('bonzini_dev_user');
  if (savedUser) {
    try {
      return JSON.parse(savedUser);
    } catch {
      return null;
    }
  }
  return null;
}
