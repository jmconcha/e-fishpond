import React, { createContext, useState, useEffect, useContext } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, database } from '@/firebase';
import { ref, onValue } from 'firebase/database';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Check if user is admin
        const userRef = ref(database, `/users/${currentUser.uid}`);
        const unsubscribeUser = onValue(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const userData = snapshot.val();
              const isUserAdmin = userData.role === 'admin';
              console.log('User role:', userData.role, 'Is admin:', isUserAdmin);
              setIsAdmin(isUserAdmin);
              setUser({ ...user, ...userData});
            } else {
              console.log('User document not found');
              setIsAdmin(false);
            }
            setLoading(false);
          },
          (error) => {
            console.error('Error checking admin role:', error);
            setIsAdmin(false);
            setLoading(false);
          }
        );
        
        // Return the unsubscribe function for cleanup
        return () => {
          unsubscribeUser();
        };
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
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
