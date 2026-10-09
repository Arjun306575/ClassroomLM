import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  increment, 
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { auth, db, googleAuthProvider, handleFirestoreError, OperationType } from './config';

// High-Cost Credit Pricing Constants (Quota-Protection Engine)
export const CREDIT_COSTS = {
  LESSON: 50,      // Max 2 Lessons / Day
  MAGIC_LENS: 25,  // Max 4 Scans / Day
  AI_SEARCH: 10,   // Max 10 Searches / Day
} as const;

export const DAILY_CREDITS_QUOTA = 100;

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  credits: number;
  lastResetDate: string; // YYYY-MM-DD
  classLevel: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedEducationalItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: 'lesson' | 'magic_lens' | 'ai_search';
  data: any;
  config: any;
  createdAt: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  credits: number;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  updateSettings: (classLevel: string, language: string) => Promise<void>;
  deductCredits: (cost: number, featureName: 'Lessons' | 'Magic Lens' | 'AI Search') => Promise<{ success: boolean; error?: string; remainingCredits?: number }>;
  savedItems: SavedEducationalItem[];
  saveItem: (item: Omit<SavedEducationalItem, 'id' | 'userId' | 'createdAt'>) => Promise<string>;
  deleteItem: (id: string) => Promise<void>;
  isAuthModalOpen: boolean;
  authModalReason: string;
  openAuthModal: (reason?: string) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getTodayUTCString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

// Password strength validator: Min 8 chars, 1 uppercase, 1 number, 1 special character
export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Include at least one uppercase letter (A-Z)");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Include at least one number (0-9)");
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push("Include at least one special character (!@#$%^&*)");
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [credits, setCredits] = useState<number>(DAILY_CREDITS_QUOTA);
  const [loading, setLoading] = useState(true);
  const [savedItems, setSavedItems] = useState<SavedEducationalItem[]>([]);
  
  // Auth Modal State for Strict Hard Lock on Generation
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string>("Sign in required to access AI features");

  const openAuthModal = useCallback((reason?: string) => {
    setAuthModalReason(reason || "Sign in required to access AI features");
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  // Listen to Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setUserProfile(null);
        setCredits(DAILY_CREDITS_QUOTA);
        setSavedItems([]);
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const today = getTodayUTCString();

      try {
        const docSnap = await getDoc(userDocRef);
        if (!docSnap.exists()) {
          // Initialize new user profile document
          const initialClass = localStorage.getItem('profileClass') || 'Class 10';
          const initialLang = localStorage.getItem('profileLang') || 'English';

          const newProfile: UserProfile = {
            id: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Student',
            photoURL: user.photoURL || '',
            credits: DAILY_CREDITS_QUOTA,
            lastResetDate: today,
            classLevel: initialClass,
            language: initialLang,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await setDoc(userDocRef, newProfile);
          setUserProfile(newProfile);
          setCredits(DAILY_CREDITS_QUOTA);
        } else {
          const data = docSnap.data() as UserProfile;
          // Daily Non-Rollover Reset Logic:
          // If currentDate !== lastResetDate: Hard reset credits = 100 (DO NOT add rollover)
          if (data.lastResetDate !== today) {
            console.log(`[Credits Engine] Daily reset triggered: ${data.lastResetDate} -> ${today}. Credits hard reset to ${DAILY_CREDITS_QUOTA}.`);
            await updateDoc(userDocRef, {
              credits: DAILY_CREDITS_QUOTA,
              lastResetDate: today,
              updatedAt: new Date().toISOString()
            });
            setUserProfile({
              ...data,
              credits: DAILY_CREDITS_QUOTA,
              lastResetDate: today
            });
            setCredits(DAILY_CREDITS_QUOTA);
          } else {
            setUserProfile(data);
            setCredits(typeof data.credits === 'number' ? data.credits : DAILY_CREDITS_QUOTA);
          }
        }
      } catch (err: any) {
        const isOffline = err?.code === 'unavailable' || err?.message?.includes('unavailable') || err?.message?.includes('offline');
        if (isOffline) {
          console.warn("[Auth Engine] Firestore connection temporarily unavailable, using offline cached profile.");
          const fallbackProfile: UserProfile = {
            id: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Student',
            photoURL: user.photoURL || '',
            credits: DAILY_CREDITS_QUOTA,
            lastResetDate: today,
            classLevel: localStorage.getItem('profileClass') || 'Class 10',
            language: localStorage.getItem('profileLang') || 'English',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          setUserProfile(fallbackProfile);
          setCredits(DAILY_CREDITS_QUOTA);
        } else {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time snapshot listener on active user document for instant credit synchronization
  useEffect(() => {
    if (!currentUser) return;
    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setUserProfile(data);
        if (typeof data.credits === 'number') {
          setCredits(data.credits);
        }
      }
    }, (error: any) => {
      const isOffline = error?.code === 'unavailable' || error?.message?.includes('unavailable') || error?.message?.includes('offline');
      if (isOffline) {
        console.warn("[Auth Engine] Firestore waiting to re-establish connection...");
        return;
      }
      handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Real-time listener for saved items in subcollection
  useEffect(() => {
    if (!currentUser) {
      setSavedItems([]);
      return;
    }

    const itemsRef = collection(db, 'users', currentUser.uid, 'savedItems');
    const q = query(itemsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: SavedEducationalItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as SavedEducationalItem);
      });
      setSavedItems(items);
    }, (error: any) => {
      const isOffline = error?.code === 'unavailable' || error?.message?.includes('unavailable') || error?.message?.includes('offline');
      if (isOffline) {
        console.warn("[Saved Items] Firestore waiting to re-establish connection...");
        return;
      }
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/savedItems`);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Retrieve fresh Firebase ID Token for Quota Hijack Prevention
  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!currentUser) return null;
    try {
      return await currentUser.getIdToken(false);
    } catch (err) {
      console.error("Failed to retrieve Firebase ID token", err);
      return null;
    }
  }, [currentUser]);

  // Google Sign-In with Popup
  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      setIsAuthModalOpen(false);
    } catch (error: any) {
      console.error("Google sign in error", error);
      throw error;
    }
  }, []);

  // Email & Password Sign-In
  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setIsAuthModalOpen(false);
    } catch (error: any) {
      console.error("Email sign-in error", error);
      throw error;
    }
  }, []);

  // Email & Password Sign-Up with strict password strength check
  const signUpWithEmail = useCallback(async (email: string, pass: string, name?: string) => {
    const strength = validatePasswordStrength(pass);
    if (!strength.isValid) {
      throw new Error(strength.errors[0]);
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      if (name && userCred.user) {
        await updateProfile(userCred.user, { displayName: name });
      }
      setIsAuthModalOpen(false);
    } catch (error: any) {
      console.error("Email registration error", error);
      throw error;
    }
  }, []);

  // Sign Out
  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      setCredits(DAILY_CREDITS_QUOTA);
      setSavedItems([]);
    } catch (error) {
      console.error("Sign out error", error);
    }
  }, []);

  // Update User Class and Language Settings in Firestore
  const updateSettings = useCallback(async (classLevel: string, language: string) => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        classLevel,
        language,
        updatedAt: new Date().toISOString()
      });
      setUserProfile(prev => prev ? { ...prev, classLevel, language } : null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  }, [currentUser]);

  // Database Atomic Credit Deduction with Insufficient Credit Guard & Daily Reset Check
  const deductCredits = useCallback(async (
    cost: number, 
    featureName: 'Lessons' | 'Magic Lens' | 'AI Search'
  ): Promise<{ success: boolean; error?: string; remainingCredits?: number }> => {
    if (!currentUser) {
      openAuthModal(`Sign in required to generate ${featureName}.`);
      return { 
        success: false, 
        error: `Authentication required. Please sign in to use ${featureName}.` 
      };
    }

    const today = getTodayUTCString();
    const userDocRef = doc(db, 'users', currentUser.uid);

    try {
      const result = await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists()) {
          throw new Error("User record not found in database.");
        }

        const data = userDoc.data() as UserProfile;
        let currentCredits = data.credits ?? DAILY_CREDITS_QUOTA;
        let lastReset = data.lastResetDate;

        // Daily Non-Rollover Reset inside the transaction to prevent race conditions
        if (lastReset !== today) {
          currentCredits = DAILY_CREDITS_QUOTA;
          lastReset = today;
        }

        // Insufficient Credit Guard:
        // "Insufficient credits. Lessons require 50 credits. Your 100 credits will refresh tomorrow at 00:00 UTC."
        if (currentCredits < cost) {
          const errorMsg = `Insufficient credits. ${featureName} requires ${cost} credits. Your 100 credits will refresh tomorrow at 00:00 UTC.`;
          return { success: false, error: errorMsg, remainingCredits: currentCredits };
        }

        const newBalance = currentCredits - cost;
        transaction.update(userDocRef, {
          credits: newBalance,
          lastResetDate: lastReset,
          updatedAt: new Date().toISOString()
        });

        return { success: true, remainingCredits: newBalance };
      });

      if (result.success && typeof result.remainingCredits === 'number') {
        setCredits(result.remainingCredits);
      }

      return result;
    } catch (err: any) {
      console.error("Credit deduction transaction error", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
      return { success: false, error: err.message || "Failed to process credits." };
    }
  }, [currentUser, openAuthModal]);

  // Save Item to Firestore subcollection
  const saveItem = useCallback(async (
    itemData: Omit<SavedEducationalItem, 'id' | 'userId' | 'createdAt'>
  ): Promise<string> => {
    if (!currentUser) {
      throw new Error("Must be logged in to save content.");
    }

    const itemId = Date.now().toString();
    const itemDocRef = doc(db, 'users', currentUser.uid, 'savedItems', itemId);
    const fullItem: SavedEducationalItem = {
      ...itemData,
      id: itemId,
      userId: currentUser.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(itemDocRef, fullItem);
      return itemId;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${currentUser.uid}/savedItems/${itemId}`);
      throw err;
    }
  }, [currentUser]);

  // Delete Item from Firestore subcollection
  const deleteItem = useCallback(async (id: string) => {
    if (!currentUser) return;
    const itemDocRef = doc(db, 'users', currentUser.uid, 'savedItems', id);
    try {
      await deleteDoc(itemDocRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/savedItems/${id}`);
    }
  }, [currentUser]);

  const value = useMemo(() => ({
    currentUser,
    userProfile,
    credits,
    loading,
    getIdToken,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOutUser,
    updateSettings,
    deductCredits,
    savedItems,
    saveItem,
    deleteItem,
    isAuthModalOpen,
    authModalReason,
    openAuthModal,
    closeAuthModal,
  }), [
    currentUser,
    userProfile,
    credits,
    loading,
    getIdToken,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOutUser,
    updateSettings,
    deductCredits,
    savedItems,
    saveItem,
    deleteItem,
    isAuthModalOpen,
    authModalReason,
    openAuthModal,
    closeAuthModal,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
