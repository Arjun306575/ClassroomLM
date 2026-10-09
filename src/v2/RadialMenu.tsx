import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Search, Calculator as CalcIcon, X, Sparkles, Image as ImageIcon } from 'lucide-react';

interface RadialMenuProps {
  onOpenMagicLensCamera: () => void;
  onOpenMagicLensUpload: () => void;
  onOpenSearch: () => void;
  onOpenCalculator: () => void;
  isDarkMode: boolean;
}

// Iconic Gemini 4-Point Astroid Colorful Spark SVG with Companion Sparkle & Gradient Halo
export function ColorfulSpark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Gemini Multi-Color Gradient */}
        <linearGradient id="geminiSparkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />   {/* Google / Gemini Blue */}
          <stop offset="32%" stopColor="#9B72CB" />  {/* Gemini Violet / Purple */}
          <stop offset="68%" stopColor="#D96570" />  {/* Coral / Magenta */}
          <stop offset="100%" stopColor="#13B5EA" /> {/* Cyan / Teal */}
        </linearGradient>

        <linearGradient id="geminiHaloGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#C084FC" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.8" />
        </linearGradient>

        <filter id="geminiSoftGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Atmospheric Glowing Aura */}
      <path
        d="M 24 3 C 24 14.5 14.5 24 3 24 C 14.5 24 24 33.5 24 45 C 24 33.5 33.5 24 45 24 C 33.5 24 24 14.5 24 3 Z"
        fill="url(#geminiHaloGradient)"
        opacity="0.45"
        filter="url(#geminiSoftGlow)"
      />

      {/* Primary 4-Point Astroid Spark */}
      <path
        d="M 24 3 C 24 14.5 14.5 24 3 24 C 14.5 24 24 33.5 24 45 C 24 33.5 33.5 24 45 24 C 33.5 24 24 14.5 24 3 Z"
        fill="url(#geminiSparkGradient)"
      />

      {/* Signature Smaller Companion Sparkle (Gemini Identity) */}
      <path
        d="M 39 5 C 39 8.8 36.8 11 33 11 C 36.8 11 39 13.2 39 17 C 39 13.2 41.2 11 45 11 C 41.2 11 39 8.8 39 5 Z"
        fill="url(#geminiSparkGradient)"
      />
    </svg>
  );
}

export function RadialMenu({
  onOpenMagicLensCamera,
  onOpenMagicLensUpload,
  onOpenSearch,
  onOpenCalculator,
  isDarkMode,
}: RadialMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showMagicSubmenu, setShowMagicSubmenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setShowMagicSubmenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Haptic feedback helper
  const triggerHaptic = (ms = 20) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  const handleToggle = () => {
    triggerHaptic(25);
    setIsOpen(!isOpen);
    setShowMagicSubmenu(false);
  };

  // Responsive Pie Menu Radial Coordinates - tuned for mobile breathing room
  const radius = isMobile ? 76 : 98;
  const diagOffset = isMobile ? -54 : -70;

  const menuItems = [
    {
      id: 'magic-lens',
      label: 'Magic Lens',
      subtitle: 'Visual Problem Solver',
      dx: 0,
      dy: -radius,
      gradient: 'from-blue-600 via-indigo-600 to-cyan-500',
      shadow: 'shadow-[0_0_25px_rgba(59,130,246,0.6)]',
      border: 'border-blue-400/50',
      icon: <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />,
      onClick: () => {
        triggerHaptic();
        setShowMagicSubmenu(!showMagicSubmenu);
      },
    },
    {
      id: 'ai-search',
      label: 'AI Search',
      subtitle: 'Instant Answers',
      dx: diagOffset,
      dy: diagOffset,
      gradient: 'from-purple-600 via-violet-600 to-indigo-600',
      shadow: 'shadow-[0_0_25px_rgba(168,85,247,0.6)]',
      border: 'border-purple-400/50',
      icon: (
        <div className="relative">
          <Search className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          <Sparkles className="w-2.5 h-2.5 text-yellow-300 absolute -top-1 -right-1.5 animate-pulse" />
        </div>
      ),
      onClick: () => {
        triggerHaptic();
        setIsOpen(false);
        onOpenSearch();
      },
    },
    {
      id: 'calculator',
      label: 'Calculator',
      subtitle: 'Free Student Math Tool',
      dx: -radius,
      dy: 0,
      gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
      shadow: 'shadow-[0_0_25px_rgba(16,185,129,0.6)]',
      border: 'border-emerald-400/50',
      icon: <CalcIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />,
      onClick: () => {
        triggerHaptic();
        setIsOpen(false);
        onOpenCalculator();
      },
    },
  ];

  return (
    <>
      {/* Background Scrim overlay when menu is open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setIsOpen(false);
              setShowMagicSubmenu(false);
            }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      {/* Floating Radial Menu Container in Bottom-Right */}
      <div 
        ref={menuRef}
        className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-50 select-none"
      >
        {/* Radial Petals / Arc Nodes without congested side reference text */}
        <AnimatePresence>
          {isOpen && (
            <div className="absolute inset-0 pointer-events-none">
              {menuItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                  animate={{ 
                    scale: 1, 
                    x: item.dx, 
                    y: item.dy, 
                    opacity: 1 
                  }}
                  exit={{ 
                    scale: 0, 
                    x: 0, 
                    y: 0, 
                    opacity: 0 
                  }}
                  transition={{ 
                    type: 'spring', 
                    damping: 20, 
                    stiffness: 300, 
                    delay: idx * 0.035 
                  }}
                  className="absolute bottom-0 right-0 flex flex-col items-center justify-center pointer-events-auto"
                >
                  {/* Circular Radial Petal Button */}
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr ${item.gradient} ${item.shadow} border-2 ${item.border} flex items-center justify-center text-white active:scale-90 hover:scale-110 transition-all duration-200 shadow-xl group relative`}
                    title={`${item.label} · ${item.subtitle}`}
                    aria-label={item.label}
                  >
                    {item.icon}

                    {/* Desktop Hover Tooltip Tag: sleek, compact, strictly centered above petal */}
                    <span className="hidden md:group-hover:flex absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-900/95 text-white border border-white/10 text-[11px] font-bold whitespace-nowrap shadow-xl pointer-events-none z-50">
                      {item.label}
                    </span>
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Magic Lens Submenu (Camera vs Upload Quick Selection) */}
        <AnimatePresence>
          {isOpen && showMagicSubmenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className={`absolute bottom-[130px] sm:bottom-[150px] right-0 p-2 rounded-2xl border shadow-2xl flex flex-col gap-1.5 min-w-[170px] backdrop-blur-xl z-50 ${
                isDarkMode ? 'bg-slate-900/95 border-blue-500/40 text-white' : 'bg-white/95 border-blue-200 text-slate-800'
              }`}
            >
              <div className="px-3 py-1 text-[10px] font-black text-blue-400 uppercase tracking-wider border-b border-white/10 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Magic Lens Action
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setIsOpen(false);
                  setShowMagicSubmenu(false);
                  onOpenMagicLensCamera();
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                  isDarkMode ? 'hover:bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-800'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div>Open Camera</div>
                  <div className="text-[10px] text-slate-400 font-normal">HDR Tap-to-Focus</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setIsOpen(false);
                  setShowMagicSubmenu(false);
                  onOpenMagicLensUpload();
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                  isDarkMode ? 'hover:bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-800'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <div>Upload Photo</div>
                  <div className="text-[10px] text-slate-400 font-normal">From Device Gallery</div>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Expand Button with Gorgeous Iridescent Glow & Cosmic Glass Styling */}
        <button
          type="button"
          onClick={handleToggle}
          className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[2.5px] transition-all duration-300 hover:scale-110 active:scale-95 group shadow-[0_10px_35px_rgba(99,102,241,0.5),_0_0_24px_rgba(56,189,248,0.4)] hover:shadow-[0_15px_50px_rgba(168,85,247,0.8),_0_0_36px_rgba(34,211,238,0.7)]"
          style={{
            background: 'linear-gradient(135deg, #38BDF8 0%, #818CF8 30%, #C084FC 60%, #F472B6 100%)',
          }}
          title={isOpen ? "Close Quick Menu" : "ClassroomLM AI Tools (Magic Lens, AI Search, Free Calculator)"}
        >
          {/* Luminous Multi-Color Outer Pulse Ring */}
          <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 opacity-40 group-hover:opacity-75 blur-md animate-pulse transition-opacity duration-300 pointer-events-none" />

          {/* Inner Disc with Deep Cosmic Glass, Specular Reflections & Ambient Flare */}
          <div className="relative w-full h-full rounded-full bg-gradient-to-b from-[#0f172a] via-[#090d16] to-[#04060a] flex items-center justify-center overflow-hidden border border-white/25 shadow-[inset_0_2px_4px_rgba(255,255,255,0.35),_inset_0_-2px_6px_rgba(0,0,0,0.8),_inset_0_0_20px_rgba(99,102,241,0.3)] backdrop-blur-xl group-hover:border-white/40 transition-all duration-300">
            {/* Ambient Nebula Radial Shimmer */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(99,102,241,0.4),rgba(217,70,239,0.22)_45%,transparent_70%)] pointer-events-none group-hover:scale-125 transition-transform duration-500" />

            {/* Specular Curved Glass Reflection Sheen */}
            <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/25 via-white/5 to-transparent rounded-t-full pointer-events-none" />

            {/* Luminous Core Bloom behind Spark */}
            <div className="absolute w-9 h-9 rounded-full bg-cyan-400/20 blur-md pointer-events-none group-hover:bg-cyan-400/35 transition-colors" />

            {/* Spark Icon with Rotation & Spring Transition */}
            <motion.div
              animate={{ 
                rotate: isOpen ? 45 : 0,
                scale: isOpen ? 0.95 : 1
              }}
              transition={{ type: 'spring', damping: 15, stiffness: 220 }}
              className="relative z-10 flex items-center justify-center"
            >
              {isOpen ? (
                <div className="relative flex items-center justify-center">
                  <X className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.95)] group-hover:scale-110 transition-transform" />
                </div>
              ) : (
                <ColorfulSpark className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-[0_0_14px_rgba(96,165,250,0.85)] group-hover:scale-110 transition-transform duration-300" />
              )}
            </motion.div>
          </div>
        </button>
      </div>
    </>
  );
}
