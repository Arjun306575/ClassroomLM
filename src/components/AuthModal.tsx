import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, User, Shield, Sparkles, Check, AlertCircle, Eye, EyeOff, Zap, BookOpen, Camera, Search, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth, validatePasswordStrength } from '../firebase/authContext';
import { executeRecaptcha, loadRecaptchaScript } from '../firebase/recaptcha';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
  isDarkMode: boolean;
  initialMode?: 'signin' | 'signup';
}

export function AuthModal({ isOpen, onClose, reason, isDarkMode, initialMode = 'signin' }: AuthModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'signin');
      setError(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (isOpen) {
      loadRecaptchaScript().catch((err) => {
        console.warn('[reCAPTCHA] Init check:', err);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const passwordRules = [
    { label: '8+ Chars', met: password.length >= 8 },
    { label: '1 Uppercase', met: /[A-Z]/.test(password) },
    { label: '1 Number', met: /[0-9]/.test(password) },
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
      // Execute reCAPTCHA security verification token on the authentication flow
      const recaptchaToken = await executeRecaptcha(mode === 'signin' ? 'login' : 'signup');
      if (recaptchaToken) {
        console.info(`[Auth reCAPTCHA] Security token generated successfully for ${mode}`);
      }

      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, name);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      let msg = err?.message || 'Authentication failed.';
      if (msg.includes('user-not-found') || msg.includes('USER_NOT_FOUND') || msg.includes('No account found')) {
        msg = 'No account found with this username or email. Please check your spelling or sign up.';
      } else if (msg.includes('wrong-password') || msg.includes('WRONG_PASSWORD') || msg.includes('Incorrect password')) {
        msg = 'Incorrect password. Please double-check your password and try again.';
      } else if (msg.includes('email-already-in-use') || msg.includes('already exists') || msg.includes('already in use')) {
        msg = 'This username or email is already registered. Please choose another username or sign in.';
      } else if (msg.includes('weak-password')) {
        msg = 'Password is too weak. Please ensure it has at least 8 characters, an uppercase letter, a number, and a special character.';
      } else if (msg.includes('OPERATION_NOT_ALLOWED') || msg.includes('operation-not-allowed')) {
        msg = 'Registration error. Please check your details and try again.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md"
        />

        {/* Modal Window: Modern Horizontal Split on Desktop, Smooth Bounded Scroll on Mobile */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ type: "spring", damping: 26, stiffness: 290 }}
          className={`relative w-full max-w-lg md:max-w-4xl max-h-[92dvh] sm:max-h-[88dvh] rounded-3xl shadow-2xl border flex flex-col md:flex-row z-10 overflow-hidden ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-700/80 text-white shadow-[0_0_60px_rgba(37,99,235,0.25)]' 
              : 'bg-white border-slate-200 text-slate-900 shadow-[0_25px_60px_rgba(0,0,0,0.18)]'
          }`}
        >
          {/* Close Button (Universal Top Right) */}
          <button
            onClick={onClose}
            className={`absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-2 rounded-full z-30 transition-all ${
              isDarkMode 
                ? 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700/60' 
                : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
            }`}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* LEFT SIDEBAR PANEL (Desktop / Tablet Benefit Showcase) */}
          <div className={`hidden md:flex md:w-5/12 flex-col justify-between p-7 lg:p-8 relative shrink-0 overflow-hidden border-r ${
            isDarkMode 
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/80 border-slate-800 text-white' 
              : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 border-blue-500 text-white'
          }`}>
            {/* Subtle background glow */}
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Top Brand Identity */}
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg ${
                  isDarkMode ? 'bg-blue-600 text-white shadow-blue-600/30' : 'bg-white text-blue-600 shadow-black/10'
                }`}>
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight leading-tight">ClassroomLM</h3>
                  <p className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-100'}`}>Interactive AI Classroom</p>
                </div>
              </div>

              <p className={`text-xs leading-relaxed mb-6 ${isDarkMode ? 'text-slate-300' : 'text-blue-100'}`}>
                Join thousands of students learning smarter with AI-guided classrooms and real-time visual problem solvers.
              </p>

              {/* Free Quota Highlight Card */}
              <div className={`p-4 rounded-2xl border mb-5 ${
                isDarkMode 
                  ? 'bg-blue-950/40 border-blue-500/30 text-white' 
                  : 'bg-white/10 backdrop-blur-md border-white/20 text-white'
              }`}>
                <div className="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider text-amber-300">
                  <Zap className="w-4 h-4 fill-amber-300" />
                  <span>100 Daily Credits Quota</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px] opacity-90">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-300 shrink-0" /> Interactive Lessons
                    </span>
                    <span className="font-bold font-mono">50 pts</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] opacity-90">
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-emerald-300 shrink-0" /> Magic Lens Vision
                    </span>
                    <span className="font-bold font-mono">25 pts</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] opacity-90">
                    <span className="flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-purple-300 shrink-0" /> AI Chalkboard
                    </span>
                    <span className="font-bold font-mono">10 pts</span>
                  </div>
                </div>
                <p className="text-[10px] mt-2.5 opacity-75 border-t border-white/10 pt-2">
                  🔄 Refreshes every 24 hours at 00:00 UTC. Non-rollover.
                </p>
              </div>

              {/* Features List */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className={isDarkMode ? 'text-slate-300' : 'text-blue-50'}>Sign up with just a username (no @ needed)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className={isDarkMode ? 'text-slate-300' : 'text-blue-50'}>Instant access to AI interactive tools</span>
                </div>
              </div>
            </div>

            {/* Bottom Security Assurance (data-testid for tests) */}
            <div 
              data-testid="recaptcha-badge"
              className={`mt-4 pt-4 border-t flex items-center justify-between text-xs ${
                isDarkMode ? 'border-slate-800 text-slate-400' : 'border-white/15 text-blue-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px]">Protected by <strong>Google reCAPTCHA</strong></span>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            </div>
          </div>

          {/* RIGHT MAIN PANEL (Interactive Authentication Form) */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-7 md:p-8">
            {/* Mobile Header Title */}
            <div className="md:hidden flex items-center gap-2.5 mb-3.5 pr-8">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black leading-tight">ClassroomLM</h3>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  100 Free Daily Credits for AI Learning
                </p>
              </div>
            </div>

            {/* Optional Reason Alert (if triggered by a locked feature) */}
            {reason && (
              <div className={`p-2.5 rounded-xl border mb-3 flex items-center gap-2 text-xs shrink-0 ${
                isDarkMode 
                  ? 'bg-blue-950/30 border-blue-500/30 text-blue-300' 
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-medium text-[11px] sm:text-xs truncate">{reason}</span>
              </div>
            )}

            {/* Segmented Mode Switcher Tabs */}
            <div className={`grid grid-cols-2 p-1 rounded-2xl border mb-4 shrink-0 ${
              isDarkMode ? 'bg-slate-800/80 border-slate-700/80' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'signin'
                    ? (isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-900 shadow-sm')
                    : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'signup'
                    ? (isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-900 shadow-sm')
                    : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                <span>Create Account</span>
              </button>
            </div>

            {/* Google One-Tap / Popup Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={`w-full py-2.5 sm:py-3 px-4 rounded-xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm mb-3 shrink-0 ${
                isDarkMode 
                  ? 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-white hover:border-slate-600' 
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 hover:border-slate-400'
              }`}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Separator */}
            <div className="flex items-center gap-3 my-1 shrink-0">
              <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                or with username
              </span>
              <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            </div>

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:gap-3 mt-1.5 flex-1">
              {mode === 'signup' && (
                <div>
                  <label className={`block text-[11px] sm:text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Student Name (Optional)
                  </label>
                  <div className="relative">
                    <User className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Enter your name"
                      className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-[11px] sm:text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Username or Email
                </label>
                <div className="relative">
                  <User className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder={mode === 'signup' ? "Choose a username (e.g. alex24) or enter your email" : "Enter your username or email"}
                    className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                    }`}
                  />
                </div>
                {mode === 'signup' && (
                  <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Use a simple username or your real email address.
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-[11px] sm:text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Password
                </label>
                <div className="relative">
                  <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="••••••••"
                    className={`w-full pl-9 pr-9 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                      error && error.includes("Incorrect password")
                        ? 'border-red-500 bg-red-500/10 text-red-500 focus:border-red-500 ring-2 ring-red-500/20'
                        : isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Compact Password Strength Indicator */}
                {mode === 'signup' && password.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-1">
                    <div className="flex gap-1 h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${
                        strengthScore <= 1 ? 'w-1/4 bg-red-500' :
                        strengthScore === 2 ? 'w-2/4 bg-amber-500' :
                        strengthScore === 3 ? 'w-3/4 bg-blue-500' : 'w-full bg-emerald-500'
                      }`} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-0.5">
                      {passwordRules.map((rule, idx) => (
                        <div key={idx} className={`text-[9px] sm:text-[10px] flex items-center gap-1 ${
                          rule.met ? 'text-emerald-500 font-semibold' : (isDarkMode ? 'text-slate-500' : 'text-slate-400')
                        }`}>
                          <Check className={`w-2.5 h-2.5 ${rule.met ? 'opacity-100' : 'opacity-30'}`} />
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold flex flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">{error}</span>
                  </div>
                  {error.includes("No account found") && mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setError(null);
                      }}
                      className="self-start text-[11px] font-bold text-blue-500 hover:text-blue-400 underline cursor-pointer ml-6"
                    >
                      Click here to create a new account with this username →
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Please wait...</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'signin' ? 'Sign In to ClassroomLM' : 'Create Free Student Account'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Mobile / Compact Footer */}
            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-center text-xs shrink-0 flex flex-col gap-1.5">
              <div>
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                  {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setError(null);
                  }}
                  className="font-bold text-blue-500 hover:underline cursor-pointer"
                >
                  {mode === 'signin' ? 'Sign Up for Free' : 'Sign In'}
                </button>
              </div>

              {/* Mobile reCAPTCHA notice */}
              <div className="md:hidden flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                <Shield className="w-3 h-3 text-blue-500" />
                <span>Protected by Google reCAPTCHA v3</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
