import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, Zap, Shield, User, LogOut, LogIn, Sparkles, BookOpen, Camera, Search, RefreshCw } from 'lucide-react';
import { useAuth, DAILY_CREDITS_QUOTA, CREDIT_COSTS } from '../firebase/authContext';

interface ProfileModalProps {
  isDarkMode: boolean;
  onClose: () => void;
  classLevel: string;
  setClassLevel: (val: string) => void;
  language: string;
  setLanguage: (val: string) => void;
  onOpenCreditModal?: () => void;
}

export function ProfileModal({ isDarkMode, onClose, classLevel, setClassLevel, language, setLanguage, onOpenCreditModal }: ProfileModalProps) {
  const { currentUser, userProfile, credits, signOutUser, updateSettings, openAuthModal } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const classes = [...Array(12)].map((_, i) => `Class ${i + 1}`);
  const languages = [
    { id: "English", label: "English" },
    { id: "Telugu", label: "Telugu (తెలుగు)" },
    { id: "Hindi", label: "Hindi (हिंदी)" },
    { id: "Spanish", label: "Spanish (Español)" },
    { id: "French", label: "French" },
    { id: "German", label: "German" },
    { id: "Japanese", label: "Japanese" },
    { id: "Mandarin", label: "Mandarin" }
  ];

  const handleClassChange = async (val: string) => {
    setClassLevel(val);
    if (currentUser) {
      await updateSettings(val, language);
    }
  };

  const handleLanguageChange = async (val: string) => {
    setLanguage(val);
    if (currentUser) {
      await updateSettings(classLevel, val);
    }
  };

  const creditPercentage = Math.min(100, Math.max(0, (credits / DAILY_CREDITS_QUOTA) * 100));

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100]"
        onClick={onClose}
      />
      <motion.div 
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className={`fixed top-0 right-0 h-[100dvh] w-full max-w-md z-[110] flex flex-col shadow-2xl border-l overflow-hidden ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-6 flex items-center justify-between border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-500 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black">Student Profile</h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {currentUser ? 'Authenticated Account' : 'Guest Preview Mode'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full transition-all bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 backdrop-blur-md"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 min-h-0 overscroll-contain">
          
          {/* User Identity Card */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between shrink-0 w-full ${
            isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="Avatar" className="w-11 h-11 rounded-full border border-blue-400 object-cover" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-base shadow-sm">
                  {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : <User className="w-5 h-5" />}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-tight">
                  {currentUser ? (currentUser.displayName || 'Student User') : 'Guest Explorer'}
                </span>
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {currentUser ? currentUser.email : 'Preview Only (No Quota)'}
                </span>
              </div>
            </div>

            {currentUser ? (
              <button
                onClick={signOutUser}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  isDarkMode 
                    ? 'border-red-500/30 text-red-400 hover:bg-red-500/20' 
                    : 'border-red-200 text-red-600 hover:bg-red-50'
                }`}
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  openAuthModal("Sign in to unlock AI features & 100 free daily credits.");
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>

          {/* High-Cost Credit Quota Counter Card */}
          <div 
            data-testid="remaining-daily-credits-box"
            className={`p-4 sm:p-5 rounded-2xl border relative shrink-0 w-full transition-colors shadow-sm ${
              isDarkMode 
                ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 border-blue-500/40 shadow-[0_0_25px_rgba(37,99,235,0.15)]' 
                : 'bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/90 border-blue-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap sm:flex-nowrap">
              <span className={`text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 min-w-0 ${
                isDarkMode ? 'text-blue-300' : 'text-blue-700'
              }`}>
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                <span className="truncate">Remaining Daily Credits</span>
              </span>
              <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full shrink-0 shadow-sm ${
                credits >= 50 
                  ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border border-emerald-300') 
                  : credits >= 25 
                  ? (isDarkMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-amber-100 text-amber-800 border border-amber-300') 
                  : (isDarkMode ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-100 text-red-800 border border-red-300')
              }`}>
                {credits} / {DAILY_CREDITS_QUOTA}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2.5">
              <span className={`text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-1 ${
                isDarkMode ? 'text-amber-400' : 'text-amber-500'
              }`}>
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 fill-current shrink-0" />
                <span>{credits}</span>
              </span>
              <span className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                / {DAILY_CREDITS_QUOTA} Credits Available
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-3 shrink-0">
              <div 
                className={`h-full transition-all duration-500 ${
                  credits >= 50 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                  credits >= 25 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                }`}
                style={{ width: `${creditPercentage}%` }}
              />
            </div>

            {/* Smartlink Top Up Action Button */}
            {onOpenCreditModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCreditModal();
                }}
                className="w-full py-2.5 px-4 mb-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer shrink-0"
              >
                <Zap className="w-4 h-4 fill-slate-950 shrink-0" />
                <span>⚡ Top Up +50 Free Credits</span>
              </button>
            )}

            {/* Usage Cost Rules Breakdown */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-blue-200/60 dark:border-slate-700/40 text-xs shrink-0">
              <div className="flex items-center justify-between py-0.5 gap-2 min-w-0">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0 truncate text-[11px] sm:text-xs font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Interactive Lesson</span>
                </span>
                <span className="font-bold font-mono text-amber-600 dark:text-amber-300 text-[11px] sm:text-xs shrink-0 text-right">50 Credits (Max 2/day)</span>
              </div>
              <div className="flex items-center justify-between py-0.5 gap-2 min-w-0">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0 truncate text-[11px] sm:text-xs font-medium">
                  <Camera className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Magic Lens Scan</span>
                </span>
                <span className="font-bold font-mono text-amber-600 dark:text-amber-300 text-[11px] sm:text-xs shrink-0 text-right">25 Credits (Max 4/day)</span>
              </div>
              <div className="flex items-center justify-between py-0.5 gap-2 min-w-0">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0 truncate text-[11px] sm:text-xs font-medium">
                  <Search className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>AI Chalkboard Search</span>
                </span>
                <span className="font-bold font-mono text-amber-600 dark:text-amber-300 text-[11px] sm:text-xs shrink-0 text-right">10 Credits (Max 10/day)</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
                <span>Refreshes daily at 00:00 UTC (Non-rollover)</span>
              </div>
            </div>
          </div>
          
          {/* Class / Grade Selection */}
          <section className="shrink-0 w-full">
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Target Class / Grade
            </h4>
            <select
              value={classLevel}
              onChange={e => handleClassChange(e.target.value)}
              className={`w-full p-3.5 rounded-2xl border font-bold text-sm appearance-none transition-all ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-500'
              }`}
            >
              {classes.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </section>

          {/* Preferred Language Selection */}
          <section className="shrink-0 w-full">
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Lesson Language
            </h4>
            <select
              value={language}
              onChange={e => handleLanguageChange(e.target.value)}
              className={`w-full p-3.5 rounded-2xl border font-bold text-sm appearance-none transition-all ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-500'
              }`}
            >
              {languages.map(lang => (
                <option key={lang.id} value={lang.id}>{lang.label}</option>
              ))}
            </select>
          </section>
          
        </div>

        {/* Footer */}
        <div className={`p-4 sm:p-6 border-t shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <button 
            onClick={onClose}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95 flex justify-center items-center gap-2 text-sm"
          >
            Save & Continue <Check className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </>
  );
}
