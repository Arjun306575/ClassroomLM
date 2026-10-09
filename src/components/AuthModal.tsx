import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Mail, User, Shield, Sparkles, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth, validatePasswordStrength } from '../firebase/authContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
  isDarkMode: boolean;
}

export function AuthModal({ isOpen, onClose, reason, isDarkMode }: AuthModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const passwordRules = [
    { label: '8+ Characters', met: password.length >= 8 },
    { label: '1 Uppercase (A-Z)', met: /[A-Z]/.test(password) },
    { label: '1 Number (0-9)', met: /[0-9]/.test(password) },
    { label: '1 Special (!@#$)', met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
  ];

  const strengthScore = passwordRules.filter(r => r.met).length;

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'signup') {
      const validation = validatePasswordStrength(password);
      if (!validation.isValid) {
        setError(validation.errors[0]);
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, name);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Authentication failed.';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        msg = 'Invalid email or password. Please verify your credentials.';
      } else if (msg.includes('email-already-in-use')) {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (msg.includes('weak-password')) {
        msg = 'Password is too weak. Please choose a stronger password.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 280 }}
          className={`relative w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl border flex flex-col z-10 overflow-hidden ${
            isDarkMode 
              ? 'bg-slate-900/95 border-slate-700/80 text-white shadow-[0_0_50px_rgba(37,99,235,0.2)]' 
              : 'bg-white/95 border-slate-200 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
          }`}
        >
          {/* Top Decorative Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className={`absolute top-5 right-5 p-2 rounded-full transition-colors ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-3">
              <Shield className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-black tracking-tight">
              {mode === 'signin' ? 'Sign In to ClassroomLM' : 'Create Student Account'}
            </h3>
            <p className={`text-xs md:text-sm mt-1 max-w-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {reason || 'Authenticate to unlock full interactive lessons and AI study tools.'}
            </p>
          </div>

          {/* Daily Quota Guarantee Banner */}
          <div className={`p-3 rounded-2xl border mb-5 flex items-start gap-3 ${
            isDarkMode 
              ? 'bg-blue-950/40 border-blue-500/30 text-blue-200' 
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold">⚡ 100 Daily Credits Quota:</span> High-tier protection. Lessons (50 credits), Magic Lens (25 credits), AI Search (10 credits). Refreshes every 24h.
            </div>
          </div>

          {/* Google One-Tap / Popup Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`w-full py-3.5 px-4 rounded-2xl border font-bold text-sm flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm mb-4 ${
              isDarkMode 
                ? 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-white hover:border-slate-600' 
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 hover:border-slate-400'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-2">
            <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              or continue with email
            </span>
            <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
            {mode === 'signup' && (
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Student Name
                </label>
                <div className="relative">
                  <User className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your name"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>
            )}

            <div>
              <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Email Address
              </label>
              <div className="relative">
                <Mail className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Password
              </label>
              <div className="relative">
                <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator for Registration */}
              {mode === 'signup' && password.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <div className="flex gap-1 h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${
                      strengthScore <= 1 ? 'w-1/4 bg-red-500' :
                      strengthScore === 2 ? 'w-2/4 bg-amber-500' :
                      strengthScore === 3 ? 'w-3/4 bg-blue-500' : 'w-full bg-emerald-500'
                    }`} />
                  </div>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {passwordRules.map((rule, idx) => (
                      <div key={idx} className={`text-[10px] flex items-center gap-1 ${
                        rule.met ? 'text-emerald-500 font-semibold' : (isDarkMode ? 'text-slate-500' : 'text-slate-400')
                      }`}>
                        <Check className={`w-3 h-3 ${rule.met ? 'opacity-100' : 'opacity-30'}`} />
                        <span>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Please wait...' : (mode === 'signin' ? 'Sign In' : 'Create Free Account')}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-5 text-center text-xs">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
              {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="font-bold text-blue-500 hover:underline"
            >
              {mode === 'signin' ? 'Sign Up' : 'Log In'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
