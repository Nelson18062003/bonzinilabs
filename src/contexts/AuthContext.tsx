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

// Generate a valid UUID from email for development
function generateDevUserId(email: string): string {
  // Create a deterministic UUID based on email hash
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Convert to hex and pad to create valid UUID format (8-4-4-4-12)
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash * 31).toString(16).padStart(8, '0');
  const hex3 = Math.abs(hash * 37).toString(16).padStart(8, '0');
  
  return `${hex.slice(0, 8)}-${hex2.slice(0, 4)}-4${hex2.slice(5, 8)}-8${hex3.slice(1, 4)}-${hex3}${hex.slice(0, 4)}`;
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
