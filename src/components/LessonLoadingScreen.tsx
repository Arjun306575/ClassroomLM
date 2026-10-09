import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Brain, BookOpen, Layers, X, Loader2 } from "lucide-react";

interface LessonLoadingScreenProps {
  isVisible: boolean;
  onCancel: () => void;
  onTimeoutFallback: () => void;
  isDarkMode: boolean;
}

const steps = [
  { text: "Analyzing learning goals...", icon: Brain },
  { text: "Structuring core concepts...", icon: Layers },
  { text: "Preparing interactive practice...", icon: BookOpen },
  { text: "Finalizing your classroom...", icon: Sparkles }
];

export default function LessonLoadingScreen({ isVisible, onCancel, onTimeoutFallback, isDarkMode }: LessonLoadingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTimeoutFallback, setShowTimeoutFallback] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0);
      setShowTimeoutFallback(false);
      return;
    }

    // Step progression
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }, 2000);

    // Timeout safeguard (10s)
    const timeout = setTimeout(() => {
      setShowTimeoutFallback(true);
    }, 10000);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(timeout);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const ActiveIcon = steps[currentStep].icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`relative w-full max-w-lg p-8 md:p-12 rounded-[2rem] flex flex-col items-center justify-center overflow-hidden border shadow-2xl ${
            isDarkMode ? "bg-slate-900 border-slate-700/50 shadow-purple-500/10" : "bg-white border-indigo-100 shadow-indigo-500/20"
          }`}
        >
          {/* Glowing background pulse */}
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: isDarkMode ? [0.2, 0.4, 0.2] : [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute w-64 h-64 rounded-full blur-[60px] pointer-events-none ${
              isDarkMode ? "bg-purple-600/30" : "bg-indigo-400/30"
            }`}
          />

          <button 
            onClick={onCancel}
            className="absolute top-6 right-6 p-2 rounded-full bg-slate-200/50 dark:bg-slate-800/50 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors z-10"
          >
            <X className={`w-5 h-5 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`} />
          </button>

          <div className="relative z-10 flex flex-col items-center w-full">
            {/* Dynamic Spinner */}
            <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
              <div className={`absolute inset-0 border-4 rounded-full ${isDarkMode ? "border-slate-800" : "border-slate-100"}`} />
              <div className={`absolute inset-0 border-4 border-transparent rounded-full animate-spin ${isDarkMode ? "border-t-purple-500 border-r-cyan-400" : "border-t-indigo-600 border-r-blue-400"}`} />
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ scale: 0, opacity: 0, rotate: -45 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0, rotate: 45 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`w-10 h-10 flex items-center justify-center rounded-full ${
                    isDarkMode ? "bg-slate-800" : "bg-white"
                  }`}
                >
                  <ActiveIcon className={`w-6 h-6 ${isDarkMode ? "text-purple-400" : "text-indigo-600"}`} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Step text */}
            <div className="h-8 mb-4 flex items-center justify-center text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  className={`font-bold text-lg font-display ${isDarkMode ? "text-white" : "text-slate-800"}`}
                >
                  {steps[currentStep].text}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress Bar */}
            <div className={`w-full max-w-xs h-2 rounded-full overflow-hidden mb-8 ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
              <motion.div 
                className={`h-full ${isDarkMode ? "bg-gradient-to-r from-purple-500 to-cyan-400" : "bg-gradient-to-r from-indigo-500 to-blue-400"}`}
                initial={{ width: "0%" }}
                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Timeout Fallback */}
            <AnimatePresence>
              {showTimeoutFallback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full"
                >
                  <div className={`p-4 rounded-xl border ${isDarkMode ? "bg-amber-900/20 border-amber-500/30 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                    <p className="text-sm text-center mb-3 font-medium">Generation is taking longer than expected.</p>
                    <button 
                      onClick={onTimeoutFallback}
                      className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                        isDarkMode ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300" : "bg-amber-100 hover:bg-amber-200 text-amber-700"
                      }`}
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Load Cached Lesson Instead
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
