import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile,
  deleteUser
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
  runTransaction,
  getDocs,
  writeBatch
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
  addCredits: (amount: number) => Promise<number>;
  savedItems: SavedEducationalItem[];
  saveItem: (item: Omit<SavedEducationalItem, 'id' | 'userId' | 'createdAt'>) => Promise<string>;
  deleteItem: (id: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
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

export function normalizeAccountIdentifier(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  // Sanitize username for internal Firebase auth email representation
  const sanitized = trimmed.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${sanitized}@classroomlm.app`;
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

  // Listen to Auth State Changes & initialize manual session fallback
  useEffect(() => {
    // 1. Check if a manual session is cached locally
    const checkManualSession = (): boolean => {
      try {
        const stored = localStorage.getItem('classroomlm_manual_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.user && parsed.token && parsed.userProfile) {
            const today = getTodayUTCString();
            const prof = parsed.userProfile as UserProfile;
            if (prof.lastResetDate !== today) {
              prof.credits = DAILY_CREDITS_QUOTA;
              prof.lastResetDate = today;
              parsed.userProfile = prof;
              localStorage.setItem('classroomlm_manual_user', JSON.stringify(parsed));
            }
            const syntheticUser = {
              uid: parsed.user.uid,
              email: parsed.user.email,
              displayName: parsed.user.displayName,
              photoURL: parsed.user.photoURL || '',
              getIdToken: async () => parsed.token
            } as any;
            setCurrentUser(syntheticUser);
            setUserProfile(prof);
            setCredits(prof.credits ?? DAILY_CREDITS_QUOTA);
            // Load manual saved items
            try {
              const savedRaw = localStorage.getItem('classroomlm_saved_lessons');
              if (savedRaw) {
                const lessons = JSON.parse(savedRaw);
                const items: SavedEducationalItem[] = lessons.map((l: any) => ({
                  id: l.id || String(Date.now()),
                  userId: parsed.user.uid,
                  title: l.title || l.config?.topic || "Lesson",
                  description: l.description || "",
                  type: 'lesson',
                  data: l.data || l,
                  config: l.config || {},
                  createdAt: l.createdAt || new Date().toISOString()
                }));
                setSavedItems(items);
              }
            } catch (e) {}
            setLoading(false);
            return true;
          }
        }
      } catch (err) {
        console.warn("[Auth Context] Error reading manual session:", err);
      }
      return false;
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // If no Firebase Auth user, check for manual user session before clearing
        const hasManual = checkManualSession();
        if (!hasManual) {
          setCurrentUser(null);
          setUserProfile(null);
          setCredits(DAILY_CREDITS_QUOTA);
          setSavedItems([]);
          setLoading(false);
        }
        return;
      }

      // User signed in with Firebase (e.g. Google Auth)
      localStorage.removeItem('classroomlm_manual_user');
      setCurrentUser(user);

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
        console.warn("[Auth Engine] Using offline cached profile fallback:", err?.message || err);
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
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time snapshot listener on active user document for instant credit synchronization
  useEffect(() => {
    if (!currentUser || currentUser.uid.startsWith('usr_')) return;
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
      console.warn("[Auth Engine] Firestore snapshot sync notice:", error?.message || error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Real-time listener for saved items in subcollection
  useEffect(() => {
    if (!currentUser || currentUser.uid.startsWith('usr_')) {
      if (!currentUser) setSavedItems([]);
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
      console.warn("[Saved Items] Firestore sync notice:", error?.message || error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Retrieve fresh Firebase ID Token or Manual Token for Quota Hijack Prevention
  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!currentUser) return null;
    try {
      if (typeof currentUser.getIdToken === 'function') {
        const token = await currentUser.getIdToken(false);
        if (token) return token;
      }
    } catch (err) {
      console.warn("getIdToken notice:", err);
    }
    const stored = localStorage.getItem('classroomlm_manual_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.token) return parsed.token;
      } catch (e) {}
    }
    return null;
  }, [currentUser]);

  // Google Sign-In with Popup
  const signInWithGoogle = useCallback(async () => {
    try {
      localStorage.removeItem('classroomlm_manual_user');
      await signInWithPopup(auth, googleAuthProvider);
      setIsAuthModalOpen(false);
    } catch (error: any) {
      console.error("Google sign in error", error);
      throw error;
    }
  }, []);

  // Username / Email & Password Sign-In
  const signInWithEmail = useCallback(async (identifier: string, pass: string) => {
    const rawInput = identifier.trim();
    if (!rawInput || !pass) {
      throw new Error("Please enter your username or email and password.");
    }

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: rawInput, password: pass })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid username or password. Please verify your credentials.");
      }

      const today = getTodayUTCString();
      const initialProfile: UserProfile = {
        id: data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName || 'Student',
        photoURL: '',
        credits: DAILY_CREDITS_QUOTA,
        lastResetDate: today,
        classLevel: localStorage.getItem('profileClass') || 'Class 10',
        language: localStorage.getItem('profileLang') || 'English',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const syntheticUser = {
        uid: data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName,
        photoURL: '',
        getIdToken: async () => data.token
      } as any;

      localStorage.setItem('classroomlm_manual_user', JSON.stringify({
        user: data.user,
        token: data.token,
        userProfile: initialProfile
      }));

      setCurrentUser(syntheticUser);
      setUserProfile(initialProfile);
      setCredits(DAILY_CREDITS_QUOTA);
      setIsAuthModalOpen(false);
    } catch (backendErr: any) {
      console.error("[Manual Sign-In Failed]", backendErr);
      throw new Error(backendErr.message || "Invalid username or password. Please verify your credentials.");
    }
  }, []);

  // Username / Email & Password Sign-Up with strict password strength check & zero Firebase errors
  const signUpWithEmail = useCallback(async (identifier: string, pass: string, name?: string) => {
    const strength = validatePasswordStrength(pass);
    if (!strength.isValid) {
      throw new Error(strength.errors[0]);
    }

    const rawInput = identifier.trim();
    if (!rawInput) {
      throw new Error("Please enter your username or email address.");
    }

    const chosenName = name?.trim() || (rawInput.includes('@') ? rawInput.split('@')[0] : rawInput);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: rawInput, password: pass, name: chosenName })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed. Please choose a different username or try again.");
      }

      const today = getTodayUTCString();
      const newProfile: UserProfile = {
        id: data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName || chosenName,
        photoURL: '',
        credits: DAILY_CREDITS_QUOTA,
        lastResetDate: today,
        classLevel: localStorage.getItem('profileClass') || 'Class 10',
        language: localStorage.getItem('profileLang') || 'English',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const syntheticUser = {
        uid: data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName,
        photoURL: '',
        getIdToken: async () => data.token
      } as any;

      localStorage.setItem('classroomlm_manual_user', JSON.stringify({
        user: data.user,
        token: data.token,
        userProfile: newProfile
      }));

      setCurrentUser(syntheticUser);
      setUserProfile(newProfile);
      setCredits(DAILY_CREDITS_QUOTA);
      setIsAuthModalOpen(false);
    } catch (backendErr: any) {
      console.error("[Manual Registration Failed]", backendErr);
      throw new Error(backendErr.message || "Registration failed. Please try again.");
    }
  }, []);

  // Sign Out
  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.warn("Sign out error", error);
    }
    localStorage.removeItem('classroomlm_manual_user');
    setCurrentUser(null);
    setUserProfile(null);
    setCredits(DAILY_CREDITS_QUOTA);
    setSavedItems([]);
  }, []);

  // Update User Class and Language Settings in Firestore or manual profile
  const updateSettings = useCallback(async (classLevel: string, language: string) => {
    if (!currentUser) return;
    setUserProfile(prev => prev ? { ...prev, classLevel, language } : null);

    // Save to manual session if applicable
    const stored = localStorage.getItem('classroomlm_manual_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.userProfile) {
          parsed.userProfile.classLevel = classLevel;
          parsed.userProfile.language = language;
          localStorage.setItem('classroomlm_manual_user', JSON.stringify(parsed));
        }
      } catch (e) {}
    }

    if (!currentUser.uid.startsWith('usr_')) {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
          classLevel,
          language,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Settings sync notice:", err);
      }
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

    // 1. Manual user balance deduction
    if (currentUser.uid.startsWith('usr_')) {
      const stored = localStorage.getItem('classroomlm_manual_user');
      let prof = stored ? JSON.parse(stored).userProfile : null;
      let cur = prof?.credits ?? credits;
      const today = getTodayUTCString();

      if (prof?.lastResetDate !== today) {
        cur = DAILY_CREDITS_QUOTA;
        if (prof) prof.lastResetDate = today;
      }

      if (cur < cost) {
        const errorMsg = `Insufficient credits. ${featureName} requires ${cost} credits. Your 100 credits will refresh tomorrow at 00:00 UTC.`;
        return { success: false, error: errorMsg, remainingCredits: cur };
      }

      const newBalance = cur - cost;
      setCredits(newBalance);
      if (prof) {
        prof.credits = newBalance;
        const parsed = JSON.parse(stored!);
        parsed.userProfile = prof;
        localStorage.setItem('classroomlm_manual_user', JSON.stringify(parsed));
      }
      return { success: true, remainingCredits: newBalance };
    }

    // 2. Firebase user Firestore transaction
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

        if (lastReset !== today) {
          currentCredits = DAILY_CREDITS_QUOTA;
          lastReset = today;
        }

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
      console.warn("Credit deduction notice, falling back to local balance update:", err?.message || err);
      // Offline fallback: allow deduction from current local state
      if (credits >= cost) {
        const newBal = credits - cost;
        setCredits(newBal);
        return { success: true, remainingCredits: newBal };
      }
      return { 
        success: false, 
        error: `Insufficient credits. ${featureName} requires ${cost} credits. Your 100 credits will refresh tomorrow at 00:00 UTC.`,
        remainingCredits: credits 
      };
    }
  }, [currentUser, credits, openAuthModal]);

  // Atomic Credit Increment for Top-ups & Rewards (Adsterra Smartlink: 1 Click = +50 Credits)
  const addCredits = useCallback(async (amount: number): Promise<number> => {
    // Guest users are strictly not allowed to top up credits
    if (!currentUser) {
      console.warn("[Credits Engine] Guest users cannot top up credits. Sign in required.");
      return 0;
    }

    const incrementAmount = Math.max(0, amount);
    
    // Instantly update local React state if balance <= 50, capping strictly at DAILY_CREDITS_QUOTA (100)
    setCredits(prev => {
      if (prev > 50) return prev; // Do not allow if user has more than 50 credits
      const next = Math.min(DAILY_CREDITS_QUOTA, prev + incrementAmount);
      try {
        localStorage.setItem('classroomlm_user_credits', next.toString());
      } catch (e) {}
      return next;
    });

    const userDocRef = doc(db, 'users', currentUser.uid);
    try {
      let finalBalance = 0;
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists()) return;
        const data = userDoc.data() as UserProfile;
        const current = data.credits ?? DAILY_CREDITS_QUOTA;
        
        // Strict guard: if current balance > 50, do not increment
        if (current > 50) {
          finalBalance = current;
          return;
        }

        finalBalance = Math.min(DAILY_CREDITS_QUOTA, current + incrementAmount);
        transaction.update(userDocRef, {
          credits: finalBalance,
          updatedAt: new Date().toISOString()
        });
      });
      if (finalBalance > 0) {
        setCredits(finalBalance);
      }
      return finalBalance;
    } catch (err: any) {
      console.warn("Could not sync credit top-up to Firestore:", err);
      return 0;
    }
  }, [currentUser]);

  // Save Item to Firestore subcollection or local storage
  const saveItem = useCallback(async (
    itemData: Omit<SavedEducationalItem, 'id' | 'userId' | 'createdAt'>
  ): Promise<string> => {
    if (!currentUser) {
      throw new Error("Must be logged in to save content.");
    }

    const itemId = Date.now().toString();
    const fullItem: SavedEducationalItem = {
      ...itemData,
      id: itemId,
      userId: currentUser.uid,
      createdAt: new Date().toISOString()
    };

    // Update state & cache immediately
    setSavedItems(prev => [fullItem, ...prev.filter(i => i.id !== itemId)]);
    try {
      const stored = localStorage.getItem('classroomlm_saved_lessons');
      const prevLessons = stored ? JSON.parse(stored) : [];
      localStorage.setItem('classroomlm_saved_lessons', JSON.stringify([fullItem, ...prevLessons.filter((l: any) => l.id !== itemId)]));
    } catch (e) {}

    if (!currentUser.uid.startsWith('usr_')) {
      try {
        const itemDocRef = doc(db, 'users', currentUser.uid, 'savedItems', itemId);
        await setDoc(itemDocRef, fullItem);
      } catch (err) {
        console.warn("[Save Item] Firestore sync notice:", err);
      }
    }

    return itemId;
  }, [currentUser]);

  // Delete Item from Firestore subcollection or local storage
  const deleteItem = useCallback(async (id: string) => {
    if (!currentUser) return;
    setSavedItems(prev => prev.filter(i => i.id !== id));
    try {
      const stored = localStorage.getItem('classroomlm_saved_lessons');
      if (stored) {
        const prevLessons = JSON.parse(stored);
        localStorage.setItem('classroomlm_saved_lessons', JSON.stringify(prevLessons.filter((l: any) => l.id !== id)));
      }
    } catch (e) {}

    if (!currentUser.uid.startsWith('usr_')) {
      try {
        const itemDocRef = doc(db, 'users', currentUser.uid, 'savedItems', id);
        await deleteDoc(itemDocRef);
      } catch (err) {
        console.warn("[Delete Item] Firestore sync notice:", err);
      }
    }
  }, [currentUser]);

  // Permanently Delete Account, all saved content, and user credentials
  const deleteAccount = useCallback(async () => {
    if (!currentUser) return;
    const uid = currentUser.uid;

    try {
      // 1. Delete all saved items in the user's subcollection
      try {
        const savedItemsRef = collection(db, 'users', uid, 'savedItems');
        const snapshot = await getDocs(savedItemsRef);
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.forEach((itemDoc) => {
            batch.delete(itemDoc.ref);
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn("[Auth Engine] Error deleting saved items during account deletion:", err);
      }

      // 2. Delete user profile document from Firestore
      try {
        const userDocRef = doc(db, 'users', uid);
        await deleteDoc(userDocRef);
      } catch (err) {
        console.warn("[Auth Engine] Error deleting user profile doc during account deletion:", err);
      }

      // 3. Clean up local storage caches
      try {
        localStorage.removeItem('profileClass');
        localStorage.removeItem('profileLang');
      } catch (e) {
        // ignore
      }

      // 4. Delete the Firebase Auth User
      await deleteUser(currentUser);

      // 5. Clean up local state
      setCurrentUser(null);
      setUserProfile(null);
      setCredits(DAILY_CREDITS_QUOTA);
      setSavedItems([]);
    } catch (error: any) {
      console.error("[Auth Engine] Delete account error:", error);
      if (error?.code === 'auth/requires-recent-login') {
        throw new Error("For security, deleting your account requires a recent sign in. Please log out, sign in again, and retry.");
      }
      throw error;
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
    addCredits,
    savedItems,
    saveItem,
    deleteItem,
    deleteAccount,
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
    addCredits,
    savedItems,
    saveItem,
    deleteItem,
    deleteAccount,
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
