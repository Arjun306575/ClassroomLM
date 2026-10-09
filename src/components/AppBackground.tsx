import React from "react";
import { motion } from "motion/react";
import { 
  Atom,
  Dna,
  Calculator,
  Globe2,
  Lightbulb,
  BookOpen,
  Compass,
  Star,
  GraduationCap
} from "lucide-react";

interface AppBackgroundProps {
  isDarkMode: boolean;
}

const FloatingBadge = ({ icon: Icon, delay, className, size = 48, duration = 6, yOffset = 20, isDarkMode }: { icon: any, delay: number, className: string, size?: number, duration?: number, yOffset?: number, isDarkMode: boolean }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.5 }}
    animate={{ 
      opacity: isDarkMode ? 0.6 : 0.8, 
      scale: 1,
      y: [0, -yOffset, 0],
      rotate: [0, 5, -5, 0]
    }}
    transition={{ 
      opacity: { duration: 1, delay },
      scale: { type: "spring", delay, stiffness: 100 },
      y: { duration, repeat: Infinity, ease: "easeInOut", delay },
      rotate: { duration: duration * 1.5, repeat: Infinity, ease: "easeInOut", delay }
    }}
    className={`absolute hidden md:flex items-center justify-center backdrop-blur-xl border shadow-xl rounded-2xl ${
      isDarkMode 
        ? "bg-white/5 border-white/10 shadow-black/50" 
        : "bg-white/40 border-white/60 shadow-indigo-500/10"
    } ${className}`}
    style={{ width: size, height: size }}
  >
    <Icon className={`${isDarkMode ? "text-white/80" : "text-indigo-600"} drop-shadow-sm`} size={size * 0.5} />
  </motion.div>
);

export default function AppBackground({ isDarkMode }: AppBackgroundProps) {
  return (
    <div className="fixed top-0 left-0 w-[100vw] h-[100vh] overflow-hidden pointer-events-none z-0">
      {/* Base Background Color */}
      <div className={`absolute inset-0 transition-colors duration-700 ${isDarkMode ? "bg-slate-950" : "bg-slate-50"}`} />
      
      {/* Animated glowing orbs for mesh gradient effect */}
      <motion.div
        animate={{ 
          
          opacity: isDarkMode ? [0.4, 0.6, 0.4] : [0.6, 0.9, 0.6],
          x: [0, 50, 0],
          y: [0, -50, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[80px] transition-colors duration-700 ${
          isDarkMode ? "bg-blue-600 opacity-50" : "bg-blue-300 opacity-60"
        }`}
      />
      
      <motion.div
        animate={{ 
          
          opacity: isDarkMode ? [0.3, 0.7, 0.3] : [0.5, 0.8, 0.5],
          x: [0, -60, 0],
          y: [0, 60, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className={`absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[80px] transition-colors duration-700 ${
          isDarkMode ? "bg-purple-600 opacity-50" : "bg-purple-300 opacity-60"
        }`}
      />
      
      <motion.div
        animate={{ 
          
          opacity: isDarkMode ? [0.4, 0.8, 0.4] : [0.5, 0.9, 0.5],
          x: [0, 40, 0],
          y: [0, 40, 0]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className={`absolute top-[20%] left-[40%] w-[40vw] h-[40vw] rounded-full blur-[80px] transition-colors duration-700 ${
          isDarkMode ? "bg-cyan-500 opacity-40" : "bg-cyan-200 opacity-50"
        }`}
      />
      
      <motion.div
        animate={{ 
          
          opacity: isDarkMode ? [0.2, 0.5, 0.2] : [0.4, 0.7, 0.4],
          x: [0, -30, 0],
          y: [0, -30, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className={`absolute bottom-[10%] left-[10%] w-[45vw] h-[45vw] rounded-full blur-[80px] transition-colors duration-700 ${
          isDarkMode ? "bg-fuchsia-600 opacity-30" : "bg-fuchsia-200 opacity-40"
        }`}
      />
      
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />

      {/* Floating Subject Stickers */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden perspective-[1000px]">
        <FloatingBadge icon={Atom} delay={0.2} className="top-[15%] left-[5%] rotate-[-12deg]" size={64} duration={7} yOffset={25} isDarkMode={isDarkMode} />
        <FloatingBadge icon={GraduationCap} delay={0.4} className="top-[60%] left-[3%] rotate-[15deg]" size={56} duration={6} yOffset={20} isDarkMode={isDarkMode} />
        <FloatingBadge icon={Calculator} delay={0.6} className="bottom-[10%] left-[15%] rotate-[-8deg]" size={48} duration={8} yOffset={15} isDarkMode={isDarkMode} />
        
        <FloatingBadge icon={Star} delay={0.3} className="top-[20%] right-[5%] rotate-[10deg]" size={72} duration={9} yOffset={30} isDarkMode={isDarkMode} />
        <FloatingBadge icon={Lightbulb} delay={0.5} className="bottom-[35%] right-[2%] rotate-[-15deg]" size={56} duration={6.5} yOffset={22} isDarkMode={isDarkMode} />
        <FloatingBadge icon={Globe2} delay={0.7} className="bottom-[15%] right-[15%] rotate-[5deg]" size={60} duration={7.5} yOffset={18} isDarkMode={isDarkMode} />
        
        <FloatingBadge icon={Compass} delay={0.8} className="top-[10%] left-[40%] rotate-[20deg]" size={40} duration={5} yOffset={10} isDarkMode={isDarkMode} />
      </div>
    </div>
  );
}
