import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, ExternalLink, Sparkles, Clock, CheckCircle2, ShieldCheck, BookOpen, Camera, Search, LogIn, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../firebase/authContext';
import { 
  ADSTERRA_SMARTLINK_URL, 
  SMARTLINK_CREDIT_REWARD, 
  SMARTLINK_COOLDOWN_SECONDS, 
  SMARTLINK_COOLDOWN_STORAGE_KEY 
} from '../config/adsterra';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export function CreditModal({ isOpen, onClose, isDarkMode }: CreditModalProps) {
  const { currentUser, credits, addCredits, openAuthModal } = useAuth();
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [justRewarded, setJustRewarded] = useState(false);

  const isGuest = !currentUser;
  const isQuotaExceeded = credits > 50;

  // Check cooldown status on mount and when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const checkCooldown = () => {
      try {
        const storedUntil = localStorage.getItem(SMARTLINK_COOLDOWN_STORAGE_KEY);
        if (storedUntil) {
          const remainingMs = Number(storedUntil) - Date.now();
          if (remainingMs > 0) {
            setCooldownSeconds(Math.ceil(remainingMs / 1000));
            return;
          } else {
            localStorage.removeItem(SMARTLINK_COOLDOWN_STORAGE_KEY);
          }
        }
      } catch (e) {}
      setCooldownSeconds(0);
    };

    checkCooldown();
    const interval = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          try {
            localStorage.removeItem(SMARTLINK_COOLDOWN_STORAGE_KEY);
          } catch (e) {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleClaimCredits = async () => {
    // 1. Guard against guest users
    if (isGuest) {
      onClose();
      openAuthModal("Sign in to earn and save free generation credits.");
      return;
    }

    // 2. Guard against credit quota overflow (cannot cross 100)
    if (credits > 50) {
      return;
    }

    if (cooldownSeconds > 0) return;

    // 3. Set 30s anti-spam cooldown in localStorage to comply with ad network anti-fraud policies
    const cooldownExpiry = Date.now() + SMARTLINK_COOLDOWN_SECONDS * 1000;
    try {
      localStorage.setItem(SMARTLINK_COOLDOWN_STORAGE_KEY, cooldownExpiry.toString());
    } catch (e) {}
    setCooldownSeconds(SMARTLINK_COOLDOWN_SECONDS);

    // 4. Open Adsterra Smartlink in a new tab safely
    window.open(ADSTERRA_SMARTLINK_URL, '_blank', 'noopener,noreferrer');

    // 5. Instantly credit +50 credits to the user's balance
    await addCredits(SMARTLINK_CREDIT_REWARD);

    // 6. Show success banner
    setJustRewarded(true);
    setTimeout(() => {
      setJustRewarded(false);
    }, 4500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md"
          />

          {/* Modal Card Window - Polished Modern Dark Theme matching ClassroomLM */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            className="relative w-full max-w-lg rounded-3xl p-4 sm:p-6 md:p-7 shadow-2xl border flex flex-col z-10 max-h-[92dvh] sm:max-h-[88vh] my-auto bg-slate-900/98 border-slate-700/80 text-white shadow-[0_0_60px_rgba(37,99,235,0.25)] overflow-hidden"
          >
            {/* Top Decorative Amber/Blue Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-b from-amber-500/20 via-blue-500/15 to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 p-2 rounded-full transition-colors z-20 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scrollable Modal Content Container */}
            <div className="w-full overflow-y-auto overscroll-contain pr-1 -mr-1 flex flex-col scrollbar-thin scrollbar-thumb-slate-700/60 scrollbar-track-transparent">
              {/* Header Area */}
              <div className="flex flex-col items-center text-center mb-4 sm:mb-6 pt-1 sm:pt-2">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/30 mb-2.5 sm:mb-4 animate-bounce-subtle shrink-0">
                  <Zap className="w-7 h-7 sm:w-8 sm:h-8 fill-slate-950" />
                </div>
                
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Top Up Generation Credits
                </h3>
                
                <p className="text-xs sm:text-sm mt-1 sm:mt-1.5 max-w-sm leading-relaxed text-slate-300">
                  Support ClassroomLM by visiting our sponsor to instantly get 50 credits!
                </p>
              </div>

              {/* Reward Alert Toast when clicked */}
              <AnimatePresence>
                {justRewarded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="mb-3 sm:mb-4 overflow-hidden shrink-0"
                  >
                    <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2.5 text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/10">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>Success! +50 Credits added to your balance instantly.</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Remaining Daily Credits Balance Display Card */}
              <div 
                data-testid="remaining-daily-credits-box"
                className="p-3.5 sm:p-4 rounded-2xl border mb-3.5 sm:mb-5 flex items-center justify-between transition-colors bg-slate-800/70 border-slate-700/60 text-white shrink-0 shadow-inner"
              >
                <div>
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold block text-slate-400">
                    Remaining Daily Credits
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black font-mono text-amber-400 flex items-center gap-1">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 shrink-0" />
                      {credits}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      / 100 Available
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    isGuest
                      ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                      : isQuotaExceeded 
                      ? 'bg-slate-700/50 border border-slate-600 text-slate-300' 
                      : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                  }`}>
                    {isGuest ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Guest Mode
                      </>
                    ) : isQuotaExceeded ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Quota Cap
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        +50 Per Click
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Button: State-Aware (Guest vs Quota Maxed vs Cooldown vs Ready) */}
              <div className="mb-3.5 sm:mb-5 shrink-0">
                {isGuest ? (
                  <button
                    onClick={() => {
                      onClose();
                      openAuthModal("Sign in to top up free generation credits.");
                    }}
                    className="w-full py-3.5 sm:py-4 px-5 sm:px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-[0.98] cursor-pointer bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.01]"
                  >
                    <LogIn className="w-5 h-5 shrink-0" />
                    <span>Sign In to Claim +50 Credits</span>
                  </button>
                ) : isQuotaExceeded ? (
                  <button
                    disabled
                    className="w-full py-3.5 sm:py-4 px-5 sm:px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-85 select-none"
                  >
                    <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>⚡ Max 100 Credits Reached</span>
                  </button>
                ) : cooldownSeconds > 0 ? (
                  <button
                    disabled
                    className="w-full py-3.5 sm:py-4 px-5 sm:px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-80"
                  >
                    <Clock className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
                    <span>Please wait {cooldownSeconds}s...</span>
                  </button>
                ) : (
                  <button
                    onClick={handleClaimCredits}
                    className="w-full py-3.5 sm:py-4 px-5 sm:px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-[0.98] cursor-pointer bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:via-orange-400 hover:to-amber-500 text-slate-950 shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.01]"
                  >
                    <Zap className="w-5 h-5 fill-slate-950 shrink-0" />
                    <span>⚡ Get 50 Free Credits</span>
                    <ExternalLink className="w-4 h-4 opacity-75 shrink-0" />
                  </button>
                )}

                {/* Contextual Subtext Below Button */}
                {isGuest ? (
                  <p className="text-[11px] text-center mt-2 text-slate-400 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Guest mode · Sign in or create an account to earn and save credits</span>
                  </p>
                ) : isQuotaExceeded ? (
                  <p className="text-[11px] text-center mt-2 text-amber-400/90 flex items-center justify-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Balance is {credits}/100. Spend credits before topping up again.</span>
                  </p>
                ) : cooldownSeconds > 0 ? (
                  <p className="text-[11px] text-center mt-2 text-slate-400 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Anti-spam cooldown active · Button ready in {cooldownSeconds}s</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-center mt-2 text-slate-400 flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>1 Click = +50 Free Credits · Instant balance update</span>
                  </p>
                )}
              </div>

              {/* Educational Costs Reference Guide */}
              <div className="p-3 sm:p-3.5 rounded-2xl border text-xs bg-slate-950/70 border-slate-800/80 text-slate-300 w-full mb-3 shrink-0">
                <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-white/10 mb-2 font-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400">
                  <span>Feature Costs</span>
                  <span>Credits Required</span>
                </div>
                
                <div className="space-y-1.5 text-[11px] sm:text-xs">
                  <div className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-white/5 transition-colors gap-2 min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0 font-medium truncate">
                      <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Full Interactive Lesson</span>
                    </span>
                    <span className="font-mono font-bold text-amber-400 shrink-0 text-right">50 Credits</span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-white/5 transition-colors gap-2 min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0 font-medium truncate">
                      <Camera className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Magic Lens Visual Problem</span>
                    </span>
                    <span className="font-mono font-bold text-amber-400 shrink-0 text-right">25 Credits</span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-white/5 transition-colors gap-2 min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0 font-medium truncate">
                      <Search className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>AI Chalkboard Search</span>
                    </span>
                    <span className="font-mono font-bold text-amber-400 shrink-0 text-right">10 Credits</span>
                  </div>
                </div>
              </div>

              {/* Footer note */}
              <div className="mt-2 sm:mt-3 pb-1 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 text-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Fair usage policy · Maximum daily balance 100 credits</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
