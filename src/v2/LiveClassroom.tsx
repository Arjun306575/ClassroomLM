import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Send, X, Loader2, Hand, Mic, Globe, 
  Library, Maximize2, Minimize2, ChevronLeft, ChevronRight, Volume2,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { PreClassroom } from './PreClassroom';
import { useAuth } from '../firebase/authContext';

// Official valid Gemini voices: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
const languageMap: Record<string, { lang: string, voice: string }> = {
  'English': { lang: 'en-US', voice: 'Kore' },
  'Spanish': { lang: 'es-ES', voice: 'Zephyr' },
  'French': { lang: 'fr-FR', voice: 'Kore' },
  'German': { lang: 'de-DE', voice: 'Fenrir' },
  'Telugu': { lang: 'te-IN', voice: 'Kore' },
  'Hindi': { lang: 'hi-IN', voice: 'Zephyr' },
  'Japanese': { lang: 'ja-JP', voice: 'Kore' },
  'Mandarin': { lang: 'cmn-CN', voice: 'Kore' },
};

function splitIntoSentences(text: string): string[] {
  const cleaned = text.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  
  // Split on sentence-ending punctuation or linebreaks (supports Latin, Hindi, Telugu, Chinese, Japanese)
  const rawSegments = cleaned
    .split(/(?<=[.?!;:।。\uff01\uff1f])\s*|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const result: string[] = [];
  for (const seg of rawSegments) {
    if (seg.length > 95) {
      // Chunk long explanations into bite-sized line-by-line captions
      const parts = seg.split(/(?<=,\s)|(?=\s+(?:and|but|because|so|while|where|which|that)\s+)/i);
      let buffer = "";
      for (const p of parts) {
        if ((buffer + " " + p).trim().length > 80 && buffer) {
          result.push(buffer.trim());
          buffer = p;
        } else {
          buffer = buffer ? `${buffer} ${p.trim()}` : p.trim();
        }
      }
      if (buffer.trim()) result.push(buffer.trim());
    } else {
      result.push(seg);
    }
  }
  return result.length > 0 ? result : [cleaned];
}

interface LiveClassroomProps {
  lessonData: any;
  onExit: () => void;
  isPreClass?: boolean;
  onPreClassGoHome?: () => void;
  onPreClassSave?: () => void;
  onPreClassEnter?: () => void;
  isDarkMode?: boolean;
}

/**
 * Dedicated Chalkboard Equation & Formula Badge
 * Renders full markdown and KaTeX equations without raw plain-text fallback.
 */
const ChalkboardEquationSpan = ({ equation }: { equation: string }) => {
  const content = React.useMemo(() => {
    if (!equation) return "";
    const trimmed = equation.trim();
    // If it already has LaTeX delimiters ($ or $$) or markdown syntax, render as-is
    if (trimmed.includes("$") || trimmed.includes("`")) {
      return trimmed;
    }
    // If it's a math/scientific expression (contains symbols or operators), wrap in $...$
    const isMathExp = /[=+\-^_{}\\/<>≤≥±×÷∫∑√πα-ωΑ-Ω]/.test(trimmed);
    if (isMathExp && !trimmed.includes("**") && !trimmed.includes("#")) {
      return `$${trimmed}$`;
    }
    return trimmed;
  }, [equation]);

  return (
    <span className="text-base sm:text-lg md:text-xl font-bold font-mono text-amber-300 bg-amber-950/70 px-4 py-1.5 rounded-xl border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] inline-flex items-center gap-2 max-w-full overflow-x-auto scrollbar-hide">
      <Sparkles className="w-4 h-4 text-amber-400 shrink-0 opacity-80" />
      <div className="chalk-math-container inline-flex items-center gap-1.5 leading-none">
        <Markdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p({ children }) {
              return <span className="inline-flex items-center gap-1.5">{children}</span>;
            },
            strong({ children }) {
              return <strong className="font-extrabold text-amber-200">{children}</strong>;
            },
            em({ children }) {
              return <em className="italic text-cyan-200">{children}</em>;
            },
            code({ children }) {
              return <code className="bg-amber-900/60 text-amber-200 px-1.5 py-0.5 rounded font-mono text-sm">{children}</code>;
            }
          }}
        >
          {content}
        </Markdown>
      </div>
    </span>
  );
};

/**
 * Buttery smooth robot mouth component:
 * Eliminates lag, unmounting jitter, and audio noise by using direct DOM refs,
 * EMA low-pass filtering, noise gating, and syllabic viseme modulation.
 * Actively moves while the AI teacher is speaking or explaining.
 */
const SmoothRobotMouth = ({ 
  isSpeaking, 
  pose, 
  analyserRef 
}: { 
  isSpeaking: boolean, 
  pose: string, 
  analyserRef: React.RefObject<AnalyserNode | null> 
}) => {
  const isExplaining = pose === 'explaining' || pose === 'pointing_whiteboard' || pose === 'writing' || pose === 'excitedly' || pose === 'celebrating' || pose === 'talking';
  const isHappy = pose === 'happy' || pose === 'laughs' || pose === 'celebrating';
  const isThinking = pose === 'thinks' || pose === 'thinking' || pose === 'curious';

  const isMouthActive = isSpeaking || isExplaining;

  // Direct DOM refs for 60fps locked smooth animation with ZERO React render delays
  const mouthBoxRef = useRef<HTMLDivElement>(null);
  const barLeftRef = useRef<HTMLDivElement>(null);
  const barCenterRef = useRef<HTMLDivElement>(null);
  const barRightRef = useRef<HTMLDivElement>(null);
  const smoothedEnergyRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      timeRef.current += dt;

      let audioEnergy = 0;
      if (analyserRef.current && isSpeaking) {
        try {
          const array = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(array);
          let sum = 0;
          const count = Math.min(array.length, 32);
          for (let i = 1; i < count; i++) {
            sum += array[i];
          }
          audioEnergy = sum / (count - 1) / 255;
        } catch (e) {}
      }

      let speechEnergy = 0;
      if (isMouthActive) {
        if (audioEnergy > 0.02) {
          speechEnergy = Math.min(1, audioEnergy * 3.2);
        } else {
          // Natural speech viseme oscillation (~4.5Hz) with secondary cadence modulation
          const wave1 = Math.sin(timeRef.current * 22) * 0.5 + 0.5;
          const wave2 = Math.sin(timeRef.current * 9) * 0.3 + 0.7;
          speechEnergy = Math.max(0.25, wave1 * wave2);
        }
      }

      // Smooth EMA filter: fast attack (opens instantly), smooth natural release (~80ms)
      const factor = speechEnergy > smoothedEnergyRef.current ? 0.38 : 0.16;
      smoothedEnergyRef.current += (speechEnergy - smoothedEnergyRef.current) * factor;

      const energy = smoothedEnergyRef.current;
      const h = Math.round(5 + energy * 15);
      const w = Math.round(24 + energy * 14);

      if (mouthBoxRef.current) {
        mouthBoxRef.current.style.height = `${h}px`;
        mouthBoxRef.current.style.width = `${w}px`;
      }
      if (barLeftRef.current) {
        barLeftRef.current.style.height = `${Math.max(2, Math.round(h * 0.45))}px`;
      }
      if (barCenterRef.current) {
        barCenterRef.current.style.height = `${Math.max(3, Math.round(h * 0.75))}px`;
      }
      if (barRightRef.current) {
        barRightRef.current.style.height = `${Math.max(2, Math.round(h * 0.45))}px`;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isMouthActive, isSpeaking, analyserRef]);

  return (
    <div className="flex items-center justify-center h-6 z-10 w-full select-none">
      {isMouthActive ? (
        // Expressive speaking/explaining mouth with smiling open curve
        <div 
          ref={mouthBoxRef}
          className="bg-slate-900 border-2 border-cyan-300 rounded-b-2xl rounded-t-sm flex items-center justify-center overflow-hidden transition-[height,width] duration-75 shadow-[0_0_16px_rgba(34,211,238,1)] relative"
          style={{ width: '32px', height: '10px' }}
        >
          {/* Smiling pink tongue / warm joyful blush inside mouth */}
          <div className="absolute bottom-0 w-4 h-2.5 bg-pink-400/90 rounded-t-full pointer-events-none" />
          {/* Internal cyber soundwave bars */}
          <div className="flex items-center justify-center gap-1 w-full px-1 z-10">
            <div ref={barLeftRef} className="w-1 bg-cyan-200 rounded-full transition-all duration-75" style={{ height: '3px' }} />
            <div ref={barCenterRef} className="w-1.5 bg-white rounded-full transition-all duration-75" style={{ height: '6px' }} />
            <div ref={barRightRef} className="w-1 bg-cyan-200 rounded-full transition-all duration-75" style={{ height: '3px' }} />
          </div>
        </div>
      ) : (
        // Bright, friendly, charming neon smile in the lesson!
        <svg width="40" height="20" viewBox="0 0 40 20" className="overflow-visible">
          {/* Cheerful upward smile curve */}
          <path 
            d="M 5 5 Q 20 20 35 5" 
            fill="none" 
            stroke="#22d3ee" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            className="filter drop-shadow-[0_0_10px_rgba(34,211,238,1)]"
          />
          {/* Cute smiling dimple corner dots */}
          <circle cx="5" cy="5" r="2" fill="#a5f3fc" />
          <circle cx="35" cy="5" r="2" fill="#a5f3fc" />
        </svg>
      )}
    </div>
  );
};

const Mascot2D = ({ 
  pose = 'happy', 
  isSpeaking, 
  analyserRef 
}: { 
  pose?: string, 
  isSpeaking: boolean, 
  analyserRef: React.RefObject<AnalyserNode | null> 
}) => {
  const isCurious = pose === 'curious' || pose === 'thoughtfully';
  const isThinking = pose === 'thinks' || pose === 'thinking';

  const [isBlinking, setIsBlinking] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  const eyeScale = isBlinking ? 0.15 : 1;

  return (
    <motion.div 
      animate={{ y: [0, -10, 0] }}
      transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
      className="relative flex flex-col items-center justify-end h-full pb-4"
    >
      {/* Robot Mascot Head */}
      <div className="w-40 md:w-48 h-36 md:h-40 bg-slate-200 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border-b-8 border-slate-300 flex flex-col items-center justify-center relative overflow-hidden z-20">
        
        {/* Antennas */}
        <div className="absolute -top-3 w-3 h-4 bg-slate-400 rounded-full" />
        <div className="absolute -top-5 w-5 h-5 bg-indigo-500 rounded-full animate-ping opacity-60" />
        <div className="absolute -top-5 w-5 h-5 bg-indigo-600 rounded-full" />

        {/* Visor Screen */}
        <div className="w-[86%] h-[74%] bg-slate-950 rounded-[2rem] border-2 border-indigo-500/40 flex flex-col items-center justify-center p-3 relative shadow-[inset_0_0_20px_rgba(99,102,241,0.5)]">
          {/* Subtle Grid on Visor */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none rounded-[2rem]" />

          {/* Cheerful Joyful Smiling Eyes container */}
          <div className="flex items-center justify-center gap-6 z-10 w-full">
            {/* Left Smiling Eye with warm upward crescent and gleam */}
            <motion.div 
              animate={{ 
                scaleY: eyeScale, 
                rotate: isCurious ? -6 : (isThinking ? 4 : 0),
                y: isThinking ? -2 : 0
              }}
              className="w-8 md:w-9 h-8 md:h-9 relative flex items-center justify-center"
            >
              <svg viewBox="0 0 36 36" className="w-full h-full overflow-visible drop-shadow-[0_0_12px_rgba(34,211,238,1)]">
                {/* Cheerful upward-curved smiling eye */}
                <path 
                  d="M 5 22 Q 18 8 31 22" 
                  fill="none" 
                  stroke="#22d3ee" 
                  strokeWidth="4.5" 
                  strokeLinecap="round" 
                />
                {/* Cheerful warm sparkle highlights */}
                <circle cx="18" cy="11" r="2.2" fill="#ffffff" />
                <circle cx="25" cy="15" r="1.5" fill="#ffffff" />
              </svg>
            </motion.div>

            {/* Right Smiling Eye with warm upward crescent and gleam */}
            <motion.div 
              animate={{ 
                scaleY: eyeScale,
                rotate: isCurious ? 6 : (isThinking ? -4 : 0),
                y: isThinking ? -2 : 0
              }}
              className="w-8 md:w-9 h-8 md:h-9 relative flex items-center justify-center"
            >
              <svg viewBox="0 0 36 36" className="w-full h-full overflow-visible drop-shadow-[0_0_12px_rgba(34,211,238,1)]">
                {/* Cheerful upward-curved smiling eye */}
                <path 
                  d="M 5 22 Q 18 8 31 22" 
                  fill="none" 
                  stroke="#22d3ee" 
                  strokeWidth="4.5" 
                  strokeLinecap="round" 
                />
                {/* Cheerful warm sparkle highlights */}
                <circle cx="18" cy="11" r="2.2" fill="#ffffff" />
                <circle cx="11" cy="15" r="1.5" fill="#ffffff" />
              </svg>
            </motion.div>
          </div>

          {/* Smooth Expressive Animated Smile Mouth */}
          <div className="mt-3 w-full">
            <SmoothRobotMouth isSpeaking={isSpeaking} pose={pose} analyserRef={analyserRef} />
          </div>
        </div>

        {/* Cheerful Rosy Blushing Cheeks */}
        <div className="absolute bottom-2.5 left-3 w-6 h-3 bg-pink-400/80 rounded-full blur-[1px] shadow-[0_0_12px_rgba(244,114,182,0.95)]" />
        <div className="absolute bottom-2.5 right-3 w-6 h-3 bg-pink-400/80 rounded-full blur-[1px] shadow-[0_0_12px_rgba(244,114,182,0.95)]" />
      </div>

      {/* Robot Torso / Body */}
      <div className="w-28 md:w-32 h-20 bg-slate-300 rounded-t-[2rem] -mt-2 border-t-4 border-slate-400 flex flex-col items-center pt-3 relative z-10 shadow-lg">
        {/* Core Heart Reactor */}
        <motion.div 
          animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="w-6 h-6 rounded-full bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.9)] border-2 border-white flex items-center justify-center"
        >
          <div className="w-2 h-2 bg-white rounded-full" />
        </motion.div>

        {/* Tie / Teacher Badge */}
        <div className="w-3 h-5 bg-indigo-600 rounded-b-md mt-1 shadow-sm" />
      </div>
    </motion.div>
  );
};

interface Blackboard2DProps {
  heading: string;
  bullets: string[];
  image?: string | null;
  imageCaption?: string;
  diagramType?: string;
  diagramLabels?: string[];
  mathEquation?: string;
  activeLineIndex?: number;
  revealedCount?: number;
  isVisualDiagramsSelected?: boolean;
}

const Blackboard2D = ({ 
  heading, 
  bullets, 
  image, 
  imageCaption, 
  diagramType, 
  diagramLabels, 
  mathEquation,
  activeLineIndex = 0,
  revealedCount,
  isVisualDiagramsSelected = false
}: Blackboard2DProps) => {
  // Guarantee ALL bullet points are displayed without missing content or premature cutoff
  const visibleBullets = bullets;
  const [isZoomed, setIsZoomed] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [image]);

  const displayImage = imgError ? null : image;
  const shouldShowImage = isVisualDiagramsSelected && Boolean(displayImage);

  return (
    <div className="w-full h-full bg-[#182336] border-[8px] md:border-[12px] border-[#334155] rounded-2xl shadow-[inset_0_0_80px_rgba(0,0,0,0.6),_0_20px_40px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col p-4 md:p-6">
      {/* Blackboard chalk grain texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
      
      {/* Chalk tray at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-3.5 bg-[#475569] border-t border-[#64748b] flex items-center px-8 gap-4 z-20">
        <div className="w-12 h-1.5 bg-white/90 rounded-full shadow-sm" />
        <div className="w-8 h-1.5 bg-amber-200/90 rounded-full shadow-sm" />
        <div className="w-10 h-1.5 bg-cyan-200/90 rounded-full shadow-sm" />
        <div className="w-9 h-1.5 bg-emerald-200/90 rounded-full shadow-sm" />
      </div>

      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Title & Math Equation header */}
        {heading && (
          <div className="border-b border-white/15 pb-2.5 mb-2.5 shrink-0 flex flex-wrap items-center justify-between gap-3">
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              key={heading}
              className="text-xl sm:text-2xl md:text-3xl font-black text-white/95 font-sans tracking-tight"
              style={{ textShadow: "0px 2px 8px rgba(0,0,0,0.6)" }}
            >
              <Markdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  p({ children }) { return <span className="inline font-sans">{children}</span>; }
                }}
              >
                {heading}
              </Markdown>
            </motion.div>
            {mathEquation && (
              <ChalkboardEquationSpan equation={mathEquation} />
            )}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 min-h-0">
          {/* Bullets List - Neat, understandable, highly legible modern educational font */}
          <div className={`flex-1 flex flex-col justify-start gap-2 sm:gap-2.5 overflow-y-auto pr-2 custom-chalk-scrollbar ${shouldShowImage ? '' : 'w-full'}`}>
            <AnimatePresence mode="popLayout">
              {visibleBullets.map((b: string, i: number) => {
                const isActive = activeLineIndex === -1 ? false : i === activeLineIndex;
                return (
                  <motion.div 
                    key={b + i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className={`text-sm sm:text-base md:text-lg font-sans font-medium flex items-start gap-2.5 sm:gap-3 leading-relaxed rounded-xl px-3 py-2 sm:py-2.5 transition-all ${
                      isActive 
                        ? 'bg-cyan-500/20 text-cyan-100 shadow-md border border-cyan-400/50' 
                        : 'text-slate-100 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold transition-all ${
                      isActive 
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.8)] scale-110' 
                        : 'bg-slate-800 text-amber-300 border border-amber-500/30'
                    }`}>
                      ✦
                    </span>
                    <div className="flex-1 chalk-markdown tracking-normal font-sans">
                      <Markdown
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p({ children }) {
                            return <p className="inline m-0 font-sans">{children}</p>;
                          },
                          strong({ children }) {
                            return <strong className="font-bold text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{children}</strong>;
                          },
                          em({ children }) {
                            return <em className="italic text-cyan-200">{children}</em>;
                          },
                          code(props) {
                            const { children } = props as any;
                            return (
                              <code className="font-mono bg-slate-900/90 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-500/30 text-xs sm:text-sm">
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {b}
                      </Markdown>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {visibleBullets.length === 0 && (
              <div className="text-slate-400 font-sans text-base sm:text-lg italic mt-4">
                Preparing chalkboard notes...
              </div>
            )}
          </div>

          {/* Related Diagram / Image Panel (ONLY shown if Visual Diagrams is selected in focus areas) */}
          {shouldShowImage && displayImage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full md:w-5/12 h-56 md:h-full flex flex-col items-center justify-center p-2 shrink-0 relative group"
            >
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950/60 rounded-xl border border-white/20 p-2 overflow-hidden shadow-2xl">
                <img 
                  src={displayImage} 
                  onError={() => setImgError(true)}
                  onClick={() => setIsZoomed(true)}
                  className="max-w-full max-h-[82%] rounded-lg object-contain cursor-zoom-in hover:brightness-105 transition-all" 
                  alt={imageCaption || "Chalkboard lesson illustration"} 
                  title="Click to view full-resolution visual"
                />
                <div className="mt-2 w-full flex items-center justify-between gap-2 px-1">
                  <span className="text-[11px] md:text-xs text-amber-300/90 font-sans font-medium truncate">
                    {imageCaption || (diagramType && diagramType !== 'none' ? `Visual Diagram: ${diagramType}` : "Visual Diagram")}
                  </span>
                  <button 
                    type="button"
                    onClick={() => setIsZoomed(true)}
                    className="text-[10px] text-cyan-300 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 shrink-0 font-mono"
                  >
                    Zoom
                  </button>
                </div>
                {diagramLabels && diagramLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 max-w-full overflow-hidden">
                    {diagramLabels.slice(0, 3).map((lbl, idx) => (
                      <span key={idx} className="text-[9px] bg-indigo-950/70 text-indigo-300 border border-indigo-700/40 px-1.5 py-0.5 rounded font-mono truncate max-w-[100px]">
                        {lbl}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen Zoom Lightbox Modal */}
              <AnimatePresence>
                {isZoomed && displayImage && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsZoomed(false)}
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-zoom-out"
                  >
                    <div className="relative max-w-4xl max-h-[85vh] flex flex-col items-center">
                      <img 
                        src={displayImage} 
                        className="max-w-full max-h-[80vh] object-contain rounded-2xl border-2 border-white/30 shadow-2xl" 
                        alt={imageCaption || "Enlarged chalkboard image"}
                      />
                      <p className="mt-3 text-sm md:text-base text-white/90 font-sans font-medium text-center">
                        {imageCaption || heading}
                      </p>
                      <button 
                        onClick={() => setIsZoomed(false)}
                        className="absolute -top-10 right-0 text-white bg-slate-800 hover:bg-slate-700 rounded-full p-2"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export function LiveClassroom({ 
  lessonData, 
  onExit, 
  isPreClass, 
  onPreClassGoHome, 
  onPreClassSave, 
  onPreClassEnter, 
  isDarkMode = true 
}: LiveClassroomProps) {
  const { getIdToken } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Lesson timeline state
  const [timeline, setTimeline] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Line-by-line caption states
  const [captionLine, setCaptionLine] = useState("Welcome to your interactive class!");

  // Blackboard display states
  const [boardHeading, setBoardHeading] = useState(lessonData?.title || "ClassroomLM");
  const [boardBullets, setBoardBullets] = useState<string[]>(["Welcome to your interactive class!"]);
  const [boardImage, setBoardImage] = useState<string | null>(null);
  const [boardImageCaption, setBoardImageCaption] = useState<string | undefined>(undefined);
  const [boardDiagramType, setBoardDiagramType] = useState<string | undefined>(undefined);
  const [boardDiagramLabels, setBoardDiagramLabels] = useState<string[]>([]);
  const [boardMathEquation, setBoardMathEquation] = useState<string | undefined>(undefined);
  const [activeBulletIndex, setActiveBulletIndex] = useState(0);
  const [revealedBulletCount, setRevealedBulletCount] = useState(1);
  const [isChalkWiping, setIsChalkWiping] = useState(false);

  // Input & doubt controls
  const [askText, setAskText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isAnsweringDoubt, setIsAnsweringDoubt] = useState(false);

  // Mascot & Audio state
  const [mascotPose, setMascotPose] = useState("happy");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSlideNarrationComplete, setIsSlideNarrationComplete] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentGainNodeRef = useRef<GainNode | null>(null);
  const lineTimersRef = useRef<NodeJS.Timeout[]>([]);
  const isMountedRef = useRef(true);

  const currentLanguage = lessonData?.config?.language || 'English';
  const currentVoiceConfig = languageMap[currentLanguage] || { lang: 'en-US', voice: 'Kore' };

  // Check if user selected visual diagrams in focus areas
  const focusAreas = lessonData?.config?.focusArea;
  const focusList = Array.isArray(focusAreas) ? focusAreas : (focusAreas ? [focusAreas] : []);
  const isVisualDiagramsSelected = focusList.some((f: string) => 
    f.toLowerCase().includes("visual") || f.toLowerCase().includes("diagram")
  );

  // Fullscreen tracking
  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn("Fullscreen toggle error", err);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Global mount/unmount audio killer to prevent any lingering noise
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearCaptionTimers();
      if (currentAudioSourceRef.current) {
        try { 
          currentAudioSourceRef.current.onended = null;
          currentAudioSourceRef.current.stop(); 
        } catch(e){}
        currentAudioSourceRef.current = null;
      }
      if (currentGainNodeRef.current) {
        try { currentGainNodeRef.current.disconnect(); } catch(e){}
        currentGainNodeRef.current = null;
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch(e){}
        audioContextRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Clear running sentence timers
  const clearCaptionTimers = () => {
    lineTimersRef.current.forEach(t => clearTimeout(t));
    lineTimersRef.current = [];
  };

  // Play audio cleanly without noise, pops, or breaking
  const playAudioWithEmotion = useCallback(async (
    textWithEmotions: string, 
    bulletPointsToSync?: string[],
    preCachedBase64Wav?: string
  ) => {
    if (!isMountedRef.current) return;
    clearCaptionTimers();
    setIsSlideNarrationComplete(false);
    setIsSpeaking(true);

    // Cancel any active speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Parse emotion tag for mascot pose
    const emotionMatch = textWithEmotions.match(/\[(.*?)\]/);
    if (emotionMatch && emotionMatch[1]) {
      setMascotPose(emotionMatch[1].toLowerCase());
    } else {
      setMascotPose('explaining');
    }

    const sentences = splitIntoSentences(textWithEmotions);
    if (sentences.length > 0) {
      setCaptionLine(sentences[0]);
    }

    try {
      let base64Wav = preCachedBase64Wav;

      if (!base64Wav) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ 
            text: textWithEmotions, 
            voice: currentVoiceConfig.voice 
          })
        });

        if (!isMountedRef.current) return;
        if (!res.ok) throw new Error("TTS fetch returned non-200");

        const json = await res.json();
        base64Wav = json.audio || json.audioContent;
      }

      if (!base64Wav || !isMountedRef.current) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (e) {
          console.warn("AudioContext resume waiting for user interaction:", e);
        }
      }

      const binary = atob(base64Wav);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      if (!isMountedRef.current) return;

      if (!analyserRef.current) {
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 256;
      }

      // Smoothly ramp down prior source to eliminate interruption clicks
      if (currentAudioSourceRef.current) {
        try { 
          if (currentGainNodeRef.current && ctx) {
            const now = ctx.currentTime;
            currentGainNodeRef.current.gain.cancelScheduledValues(now);
            currentGainNodeRef.current.gain.setValueAtTime(currentGainNodeRef.current.gain.value, now);
            currentGainNodeRef.current.gain.linearRampToValueAtTime(0, now + 0.03);
          }
          const oldSource = currentAudioSourceRef.current;
          setTimeout(() => {
            try { 
              oldSource.onended = null;
              oldSource.stop(); 
            } catch(e){}
          }, 35);
        } catch(e){}
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Anti-cracking GainNode envelope: smooth gentle fade-out at end of audio buffer
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1, ctx.currentTime);
      const fadeOutTime = Math.max(0, audioBuffer.duration - 0.08);
      gainNode.gain.setValueAtTime(1, ctx.currentTime + fadeOutTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + audioBuffer.duration);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      if (analyserRef.current) {
        source.connect(analyserRef.current);
      }
      currentGainNodeRef.current = gainNode;

      source.onended = () => {
        if (isMountedRef.current) {
          setMascotPose('neutral');
          setIsSpeaking(false);
        }
      };

      currentAudioSourceRef.current = source;
      source.start(0);

      const durationMs = audioBuffer.duration * 1000;
      const sentenceInterval = durationMs / Math.max(1, sentences.length);

      // Schedule line-by-line captions synced to audio duration
      sentences.forEach((s, idx) => {
        if (idx === 0) return;
        const timer = setTimeout(() => {
          if (!isMountedRef.current) return;
          setCaptionLine(s);

          // If bullet points exist, advance active line highlight line-by-line
          if (bulletPointsToSync && bulletPointsToSync.length > 0) {
            const mappedBulletIdx = Math.min(idx, bulletPointsToSync.length - 1);
            setActiveBulletIndex(mappedBulletIdx);
            setRevealedBulletCount(prev => Math.max(prev, mappedBulletIdx + 1));
          }
        }, idx * sentenceInterval);
        lineTimersRef.current.push(timer);
      });

      // Wait for audio playback to finish completely
      await new Promise(r => setTimeout(r, durationMs));
      if (isMountedRef.current) {
        setIsSpeaking(false);
        setIsSlideNarrationComplete(true);
        setActiveBulletIndex(-1);
        setRevealedBulletCount(bulletPointsToSync ? bulletPointsToSync.length : 10);
      }

    } catch (err) {
      if (!isMountedRef.current) return;
      console.warn("Gemini TTS fallback to browser SpeechSynthesis:", err);

      // Clean browser voice speech fallback in user's language
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const cleanSpokenText = textWithEmotions.replace(/\[.*?\]/g, "").trim();
          const utterance = new SpeechSynthesisUtterance(cleanSpokenText || textWithEmotions);
          utterance.lang = currentVoiceConfig.lang || 'en-US';
          utterance.rate = 1.0;
          utterance.onstart = () => {
            if (isMountedRef.current) {
              setMascotPose('explaining');
              setIsSpeaking(true);
              setIsSlideNarrationComplete(false);
            }
          };
          utterance.onend = () => {
            if (isMountedRef.current) {
              setMascotPose('happy');
              setIsSpeaking(false);
              setIsSlideNarrationComplete(true);
              setActiveBulletIndex(-1);
              setRevealedBulletCount(bulletPointsToSync ? bulletPointsToSync.length : 10);
            }
          };
          window.speechSynthesis.speak(utterance);
        } catch (synthErr) {
          console.warn("SpeechSynthesis error:", synthErr);
        }
      }

      // Progress line-by-line synced with captions and blackboard bullets
      setIsSpeaking(true);
      for (let i = 0; i < sentences.length; i++) {
        if (!isMountedRef.current) return;
        setCaptionLine(sentences[i]);
        if (bulletPointsToSync && bulletPointsToSync.length > 0) {
          const bIdx = Math.min(i, bulletPointsToSync.length - 1);
          setActiveBulletIndex(bIdx);
          setRevealedBulletCount(prev => Math.max(prev, bIdx + 1));
        }
        await new Promise(r => setTimeout(r, 2600));
      }
      if (isMountedRef.current) {
        setMascotPose('happy');
        setIsSpeaking(false);
        setIsSlideNarrationComplete(true);
        setActiveBulletIndex(-1);
        setRevealedBulletCount(bulletPointsToSync ? bulletPointsToSync.length : 10);
      }
    }
  }, [currentVoiceConfig]);

  // Load and apply a specific step from the lesson timeline
  const applyTimelineStep = useCallback(async (step: any, stepIdx: number, total: number) => {
    setIsSlideNarrationComplete(false);
    setIsSpeaking(false);
    if (currentAudioSourceRef.current) {
      try { 
        currentAudioSourceRef.current.onended = null;
        currentAudioSourceRef.current.stop(); 
      } catch(e){}
      currentAudioSourceRef.current = null;
    }
    clearCaptionTimers();

    setIsChalkWiping(true);
    setTimeout(() => setIsChalkWiping(false), 900);

    const wb = step.whiteboardContent || step.whiteboard || step.board || {};
    const rawHeading = wb.heading || wb.title || wb.header || `Slide ${stepIdx + 1}`;
    setBoardHeading(rawHeading);

    let rawBullets = wb.bulletPoints || wb.bullet_points || wb.bullets || wb.points || wb.keyPoints || wb.key_points || wb.content || [];
    if (typeof rawBullets === 'string') {
      rawBullets = rawBullets
        .split('\n')
        .map((s: string) => s.replace(/^[-*•\d.]+\s*/, '').trim())
        .filter((s: string) => s.length > 0);
    } else if (!Array.isArray(rawBullets)) {
      rawBullets = [];
    }

    // Safeguard: Guarantee at least 3 bullet points are populated so board is NEVER empty
    if (rawBullets.length === 0) {
      const topicName = lessonData?.config?.topic || lessonData?.title || "Educational Topic";
      const dialogueText = step.spokenDialogue || step.bubbleCaption || "";
      const sentences = dialogueText.replace(/\[.*?\]/g, "").split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 8);
      if (sentences.length >= 2) {
        rawBullets = sentences.slice(0, 3).map((s: string, idx: number) => `**Core Concept ${idx + 1}**: ${s}`);
      } else {
        rawBullets = [
          `**Core Foundation**: Primary principles and definitions governing ${topicName}`,
          `**Step Analysis**: Critical interacting mechanisms and transformations`,
          `**Key Takeaway**: Essential application and boundary considerations`
        ];
      }
    }

    setBoardBullets(rawBullets);
    setBoardImage(wb.imageUrl || null);
    setBoardImageCaption(wb.imageCaption || undefined);
    setBoardDiagramType(wb.diagramType || undefined);
    setBoardDiagramLabels(wb.diagramLabels || []);
    setBoardMathEquation(wb.mathEquation || undefined);
    
    // Start with line 1 revealed
    setActiveBulletIndex(0);
    setRevealedBulletCount(1);

    const spoken = step.spokenDialogue || step.bubbleCaption || "";
    if (spoken && isMountedRef.current) {
      await playAudioWithEmotion(spoken, rawBullets, step.ttsAudio);
    }
  }, [playAudioWithEmotion, lessonData]);

  // Initial startup: generate or load lesson steps
  useEffect(() => {
    const initLesson = async () => {
      setTimeout(() => {
        if (isMountedRef.current) setIsReady(true);
      }, 800);

      // Check if timeline was generated by GeneratingClassroom or loaded from Saved Content
      let existingTimeline = lessonData?.timeline || 
                             lessonData?.data?.timeline || 
                             (lessonData?.data?.data && lessonData?.data?.data?.timeline) ||
                             (Array.isArray(lessonData?.data) ? lessonData?.data : undefined);

      if (typeof existingTimeline === 'string') {
        try { existingTimeline = JSON.parse(existingTimeline); } catch (e) {}
      }

      const isFromSaved = Boolean(
        lessonData?.isLoadedFromSaved || 
        lessonData?.loadedFromSaved ||
        lessonData?.data?.isLoadedFromSaved ||
        lessonData?.data?.loadedFromSaved ||
        lessonData?.isSavedLesson ||
        lessonData?.data?.isSavedLesson ||
        lessonData?.type === 'lesson'
      );

      if (isFromSaved || (existingTimeline && Array.isArray(existingTimeline) && existingTimeline.length > 0)) {
        // STRICT REQUIREMENT: If loaded from Saved Content, NEVER GENERATE AGAIN!
        // Immediately load the saved timeline into state and display slide 1
        const timelineToUse = (existingTimeline && Array.isArray(existingTimeline) && existingTimeline.length > 0)
          ? existingTimeline
          : [
              {
                timestamp: "Slide 1: Overview & Review",
                teacherGesture: "happy",
                spokenDialogue: `Welcome back! Let us review the key principles of ${lessonData?.title || "our saved lesson"} right here on the blackboard.`,
                bubbleCaption: `Reviewing ${lessonData?.title || "Saved Content"}`,
                whiteboardContent: {
                  heading: lessonData?.title || "Saved Lesson",
                  bulletPoints: [
                    `Reviewing core concepts and principles of ${lessonData?.title || "this topic"}`,
                    "Key high-yield takeaways and operational steps from your saved session",
                    "Ready for active review, doubts, and interactive practice"
                  ],
                  diagramType: "none"
                }
              }
            ];

        setTimeline(timelineToUse);
        setCurrentStepIndex(0);
        await applyTimelineStep(timelineToUse[0], 0, timelineToUse.length);
        return;
      }

      // If no timeline yet (fresh new generation from prompt), generate multi-slide lesson with Gemini
      try {
        const topic = lessonData?.config?.topic || lessonData?.title || "Educational Topic";
        const persona = lessonData?.config?.persona || "Friendly Mentor";
        const focusArea = lessonData?.config?.focusArea || [];
        setBoardHeading(topic);
        setBoardBullets(["Connecting to AI Classroom Engine...", `Preparing blackboard slides with ${persona}...`]);
        setCaptionLine(`Preparing lesson slides for "${topic}" in ${currentLanguage}...`);
        
        const token = await getIdToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/generate-lesson", {
          method: "POST",
          headers,
          body: JSON.stringify({
            customTopic: topic,
            prompt: topic,
            persona: persona,
            focusArea: focusArea,
            language: currentLanguage,
            gradeLevel: lessonData?.config?.classLevel || "Class 10",
            voice: currentVoiceConfig.voice
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (isMountedRef.current && data.timeline && Array.isArray(data.timeline) && data.timeline.length > 0) {
            setTimeline(data.timeline);
            setCurrentStepIndex(0);
            await applyTimelineStep(data.timeline[0], 0, data.timeline.length);
            return;
          }
        }
      } catch (e) {
        console.warn("Auto-generate lesson failed, using multi-slide interactive deck", e);
      }

      // Fallback multi-slide timeline in current language
      if (isMountedRef.current) {
        const topic = lessonData?.config?.topic || lessonData?.title || "Interactive Lesson";
        const fallbackSteps = [
          {
            timestamp: "Slide 1: The Core Mystery",
            teacherGesture: "thinking",
            spokenDialogue: `Have you ever wondered what actually makes ${topic} so fascinating? Let us uncover the mystery right here on the blackboard!`,
            bubbleCaption: `Unlocking the core mystery of ${topic}`,
            whiteboardContent: {
              heading: `${topic}: The Core Mystery`,
              bulletPoints: [
                `**Core Question**: What fundamentally defines ${topic}?`,
                "**The Central Dilemma**: How does this principle operate in nature?",
                "**Significance**: Why this discovery changed our understanding"
              ],
              diagramType: "none"
            }
          },
          {
            timestamp: "Slide 2: Foundations & Principles",
            teacherGesture: "explaining",
            spokenDialogue: `Now, let us establish the foundational principles of ${topic}. Notice how each key definition connects seamlessly.`,
            bubbleCaption: `Essential foundations of ${topic}`,
            whiteboardContent: {
              heading: "Key Foundations & Terms",
              bulletPoints: [
                "**Primary Axiom**: Core rules and foundational definitions",
                "**Active Variables**: How energy, force, or logic flows through the system",
                "**Boundary Conditions**: Key operational constraints to remember"
              ],
              diagramType: "none"
            }
          },
          {
            timestamp: "Slide 3: Deep Dive & Derivation",
            teacherGesture: "writing",
            spokenDialogue: `Here is the heart of the lesson. Follow the derivation step-by-step on the chalkboard!`,
            bubbleCaption: `Step-by-step deep dive into ${topic}`,
            whiteboardContent: {
              heading: "Deep Dive & Mechanism",
              bulletPoints: [
                "**Step 1**: Isolate the principal equations or core mechanism",
                "**Step 2**: Apply the governing scientific law or formula",
                "**Step 3**: Arrive at the exact quantitative or structural outcome"
              ],
              mathEquation: "f(x) = \\sum_{i=1}^n a_i x^i",
              diagramType: "none"
            }
          },
          {
            timestamp: "Slide 4: Real-World Demonstration",
            teacherGesture: "pointing_whiteboard",
            spokenDialogue: `Where do we see this in the real world? From engineering to nature, this principle governs real-world behavior!`,
            bubbleCaption: `Real-world applications of ${topic}`,
            whiteboardContent: {
              heading: "Real-World Applications",
              bulletPoints: [
                "**Practical Engineering**: Modern industrial and technological uses",
                "**Nature & Environment**: Observable phenomena in everyday life",
                "**Case Study**: Concrete evidence you can test and observe"
              ],
              diagramType: "none"
            }
          },
          {
            timestamp: "Slide 5: Pro-Tips & Master Summary",
            teacherGesture: "celebrating",
            spokenDialogue: `To ace this topic, keep these golden takeaways and common pitfalls in mind. Outstanding focus today!`,
            bubbleCaption: `Master summary and key exam takeaways`,
            whiteboardContent: {
              heading: "SUMMARY & PRO-TIPS",
              bulletPoints: [
                "**Golden Rule**: Master the first principle before memorizing formulas",
                "**Common Pitfall**: Don't confuse the underlying causes with secondary effects",
                "**High-Yield Tip**: Always verify boundary conditions and units"
              ],
              diagramType: "none"
            }
          }
        ];
        setTimeline(fallbackSteps);
        setCurrentStepIndex(0);
        await applyTimelineStep(fallbackSteps[0], 0, fallbackSteps.length);
      }
    };

    initLesson();
  }, [lessonData, currentLanguage, currentVoiceConfig, applyTimelineStep]);

  const handleReplayCurrentSlide = () => {
    if (timeline[currentStepIndex]) {
      applyTimelineStep(timeline[currentStepIndex], currentStepIndex, timeline.length);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      const newIdx = currentStepIndex - 1;
      setCurrentStepIndex(newIdx);
      applyTimelineStep(timeline[newIdx], newIdx, timeline.length);
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < timeline.length - 1) {
      const newIdx = currentStepIndex + 1;
      setCurrentStepIndex(newIdx);
      applyTimelineStep(timeline[newIdx], newIdx, timeline.length);
    }
  };

  // Student asking a doubt
  const submitQuestionText = async (doubtQuestion: string) => {
    if (!doubtQuestion.trim()) return;
    clearCaptionTimers();
    setIsAnsweringDoubt(true);
    setAskText("");
    
    setCaptionLine(`"${doubtQuestion}"`);

    setIsChalkWiping(true);
    setBoardHeading("Analyzing Question...");
    setBoardBullets(["Reviewing student question...", "Formatting clear step-by-step notes..."]);
    setBoardImage(null);
    setMascotPose("thinking");
    setTimeout(() => setIsChalkWiping(false), 900);

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/ask-doubt", {
        method: "POST",
        headers,
        body: JSON.stringify({
          doubt: doubtQuestion,
          lessonContext: {
            title: boardHeading,
            currentWhiteboard: {
              heading: boardHeading,
              bulletPoints: boardBullets
            },
            config: lessonData?.config
          },
          language: currentLanguage,
          gradeLevel: lessonData?.config?.classLevel || "Class 10"
        })
      });

      const data = await res.json();
      
      if (data.whiteboardChanges) {
        setBoardHeading(data.whiteboardChanges.heading || "Explanation");
        const bullets = data.whiteboardChanges.bulletPoints || [];
        setBoardBullets(bullets);
        setBoardMathEquation(data.whiteboardChanges.mathEquation || undefined);
        setBoardDiagramType(data.whiteboardChanges.diagramType || undefined);
        setActiveBulletIndex(0);
        setRevealedBulletCount(1);
      }

      if (data.dialogue) {
        await playAudioWithEmotion(data.dialogue, data.whiteboardChanges?.bulletPoints);
      }

      if (data.transitionBack) {
        await playAudioWithEmotion(data.transitionBack);
      }

    } catch (err) {
      console.error("Ask doubt error:", err);
      setCaptionLine("Sorry, couldn't process that question. Please try asking again.");
    } finally {
      setIsAnsweringDoubt(false);
    }
  };

  const submitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuestionText(askText);
  };

  // Raise hand to speak a question
  const handleRaiseHand = async () => {
    if (isListening) return;
    setIsListening(true);
    setCaptionLine("[curious] Yes, what's your question?");
    await playAudioWithEmotion("[curious] Yes? What is your question?");
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = currentVoiceConfig.lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setAskText(transcript);
        submitQuestionText(transcript);
      };
      recognition.onspeechend = () => {
        recognition.stop();
        setIsListening(false);
      };
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        setCaptionLine("Didn't catch that clearly. Please type your doubt in the box below.");
      };
      recognition.start();
    } else {
      setCaptionLine("Speech recognition is unavailable in this browser. Please type your doubt.");
      setIsListening(false);
    }
  };

  const handleUserInteraction = () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  };

  return (
    <div onClickCapture={handleUserInteraction} className="fixed inset-0 w-full h-full bg-slate-950 text-white overflow-hidden z-[100] flex flex-col">
      {/* PRE-CLASS LOADING OVERLAY */}
      <AnimatePresence>
        {isPreClass && !isReady && (
          <motion.div 
            initial={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.7 }}
            className={`absolute inset-0 z-[150] flex flex-col items-center justify-center p-8 text-center ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}
          >
            <Loader2 className="w-14 h-14 text-indigo-500 animate-spin mb-6" />
            <h2 className={`text-3xl font-black mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Preparing Full-Screen Classroom...
            </h2>
            <p className={`max-w-md text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Connecting AI teacher, chalkboard notes, and curriculum...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRE-CLASSROOM SPLASH SCREEN */}
      <AnimatePresence>
        {isPreClass && isReady && (
          <motion.div
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-[140]"
          >
            <PreClassroom 
              lessonData={lessonData}
              onEnter={onPreClassEnter || (() => {})}
              onSaveLater={onPreClassSave || (() => {})}
              onGoHome={onPreClassGoHome || (() => {})}
              isDarkMode={isDarkMode}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL-SCREEN IMMERSIVE CLASSROOM */}
      {!isPreClass && isReady && (
        <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-slate-950">
          
          {/* TOP CLASSROOM NAVIGATION BAR - Clean, Mobile Optimized */}
          <header className="h-11 sm:h-14 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-2.5 sm:px-4 md:px-6 flex items-center justify-between shrink-0 z-30 shadow-md">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <h2 className="text-xs sm:text-sm md:text-base font-bold text-white tracking-wide truncate max-w-[160px] xs:max-w-[220px] sm:max-w-none">
                {lessonData?.title || "ClassroomLM Live Session"}
              </h2>
              <span className="text-[10px] sm:text-xs bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full font-medium hidden md:inline shrink-0">
                {lessonData?.config?.classLevel || "Class 10"} • {currentLanguage}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
              {/* Fullscreen Toggle Button */}
              <button
                onClick={toggleFullScreen}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors shrink-0"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </button>

              {/* Exit Button */}
              <button 
                onClick={onExit}
                className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-sm shrink-0"
                title="Leave Classroom"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Leave Class</span>
              </button>
            </div>
          </header>

          {/* MAIN CLASSROOM STAGE: SERENE CLASSROOM WALL WITH SCENIC WINDOW */}
          <main className="flex-1 w-full relative overflow-hidden flex flex-row p-3 md:p-6 gap-3 md:gap-6 bg-gradient-to-b from-[#182337] via-[#121c2d] to-[#0c1320] min-h-0">
            {/* ONLY INCLUDE THE WINDOW (All past backgrounds removed) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
              {/* Soft, gentle natural daylight glow streaming from the window */}
              <div className="absolute top-2 left-6 sm:left-14 w-80 sm:w-96 h-80 sm:h-96 bg-gradient-to-br from-amber-300/15 via-sky-300/10 to-transparent rounded-full blur-3xl pointer-events-none" />

              {/* Arched Multi-Pane Classroom Window looking outside to scenic view */}
              <div className="absolute top-4 left-6 sm:left-14 transition-all">
                <div className="relative w-40 sm:w-52 h-44 sm:h-56 rounded-t-full border-4 border-amber-100/60 bg-gradient-to-b from-sky-400 via-sky-300 to-amber-100 shadow-[0_0_40px_rgba(56,189,248,0.35),_inset_0_0_25px_rgba(255,255,255,0.7)] overflow-hidden flex flex-col justify-between">
                  {/* Fluffy drifting morning clouds */}
                  <div className="absolute top-4 left-4 w-16 h-5 bg-white/80 rounded-full blur-[1px]" />
                  <div className="absolute top-7 right-4 w-20 h-6 bg-white/70 rounded-full blur-[1px]" />
                  {/* Gentle warm sun glow in sky */}
                  <div className="absolute top-3 right-6 w-9 h-9 bg-amber-200/90 rounded-full blur-[2px] shadow-[0_0_15px_rgba(251,191,36,0.8)]" />

                  {/* Serene rolling green hills outside */}
                  <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 rounded-t-[2.5rem] opacity-95" />
                  <div className="absolute -bottom-2 -left-3 w-32 h-12 bg-emerald-700/80 rounded-t-full" />
                  <div className="absolute -bottom-1 right-1 w-28 h-10 bg-emerald-600/90 rounded-t-full" />

                  {/* Window frame mullions / grilles (crossbars) */}
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 bg-amber-100/70 shadow-sm" />
                  <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-1.5 bg-amber-100/70 shadow-sm" />

                  {/* Subtle glass reflection highlight angle across panes */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none -rotate-12 translate-x-3 scale-125" />
                </div>

                {/* Wooden windowsill at base of window */}
                <div className="w-[108%] -ml-[4%] h-3 bg-gradient-to-r from-amber-200 via-amber-100 to-amber-200 rounded-full shadow-md border-t border-white/50" />
              </div>
            </div>

            {/* Mascot Teacher Character (Left Column) */}
            <aside className="relative z-10 w-36 sm:w-44 md:w-56 lg:w-64 shrink-0 h-full flex flex-col items-center justify-end pb-2 select-none">
              <Mascot2D pose={mascotPose} isSpeaking={isSpeaking} analyserRef={analyserRef} />
              <div className="mt-1 text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                  AI Teacher
                </span>
              </div>
            </aside>

            {/* Large Full-Screen Blackboard (No top tabs, maximum space for learning) */}
            <section className="relative z-10 flex-1 h-full min-w-0 flex flex-col">
              <div className="relative flex-1 min-h-0">
                {isChalkWiping && (
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 0.9, ease: "easeInOut" }}
                    className="absolute inset-0 z-50 flex items-center shadow-2xl pointer-events-none"
                  >
                    <div className="w-24 md:w-32 h-full bg-white/30 blur-2xl" />
                    <div className="w-[150%] h-full bg-[#1e293b]" />
                  </motion.div>
                )}
                <Blackboard2D 
                  heading={boardHeading} 
                  bullets={boardBullets} 
                  image={boardImage}
                  imageCaption={boardImageCaption}
                  diagramType={boardDiagramType}
                  diagramLabels={boardDiagramLabels}
                  mathEquation={boardMathEquation}
                  activeLineIndex={activeBulletIndex}
                  revealedCount={revealedBulletCount}
                  isVisualDiagramsSelected={isVisualDiagramsSelected}
                />
              </div>
            </section>
          </main>

          {/* COMPACT LINE-BY-LINE CAPTIONS */}
          <div className="w-full flex justify-center px-4 -mb-1 z-30 pointer-events-none">
            <AnimatePresence mode="wait">
              {captionLine && (
                <motion.div 
                  key={captionLine}
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-2xl pointer-events-auto px-5 py-2 bg-slate-950/95 backdrop-blur-md rounded-2xl border border-cyan-500/30 shadow-2xl flex items-center justify-center text-center"
                >
                  <p className="text-xs md:text-sm font-medium text-white/95 leading-snug line-clamp-1 truncate">
                    {captionLine}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* DOCKED BOTTOM CONTROL BAR: Raise Hand, Doubt Box, Slide Navigation, Replay */}
          <footer className="w-full bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 z-40 shrink-0 shadow-2xl">
            
            {/* Left Action Buttons: Raise Hand & Replay Voice */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              {/* Raise Hand: Voice Doubt input */}
              <button
                type="button"
                onClick={handleRaiseHand}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs md:text-sm transition-all shadow-lg active:scale-95 ${
                  isListening
                    ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse ring-4 ring-amber-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
                title="Raise hand to speak your question"
              >
                {isListening ? <Mic className="w-4 h-4" /> : <Hand className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {isListening ? 'Listening...' : 'Raise Hand'}
                </span>
              </button>

              {/* Replay voice button */}
              <button
                type="button"
                onClick={handleReplayCurrentSlide}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs md:text-sm font-semibold transition-colors shadow-sm"
                title="Replay teacher voice for this slide"
              >
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Replay</span>
              </button>
            </div>

            {/* Center: Ask Question / Doubt Input Bar */}
            <form onSubmit={submitQuestion} className="flex-1 max-w-xl min-w-[220px] relative">
              <input 
                type="text"
                value={askText}
                onChange={(e) => setAskText(e.target.value)}
                placeholder="Ask any question or doubt about this slide..."
                disabled={isAnsweringDoubt}
                className="w-full bg-slate-800/90 hover:bg-slate-800 focus:bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-full px-5 py-2.5 pr-12 text-xs md:text-sm text-white placeholder-slate-400 focus:outline-none transition-all shadow-inner disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!askText.trim() || isAnsweringDoubt}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-full transition-colors"
                title="Send Question"
              >
                {isAnsweringDoubt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </form>

            {/* Right: Slide Step Navigation */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Prominent Blinking Next Slide Action Button after TTS Audio Completes */}
              {isSlideNarrationComplete && currentStepIndex < timeline.length - 1 && (
                <motion.button
                  type="button"
                  onClick={handleNextStep}
                  animate={{ 
                    scale: [1, 1.08, 1],
                    opacity: [1, 0.7, 1],
                    boxShadow: [
                      "0 0 6px rgba(34,211,238,0.5)",
                      "0 0 28px rgba(34,211,238,1)",
                      "0 0 6px rgba(34,211,238,0.5)"
                    ]
                  }}
                  transition={{ repeat: Infinity, duration: 0.9, ease: "easeInOut" }}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-slate-950 font-black text-xs md:text-sm shadow-xl ring-2 ring-cyan-200 cursor-pointer animate-pulse"
                  title="Narration complete! Click to advance to next slide"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-current text-amber-200 animate-spin" />
                  <span className="tracking-wide">Next Slide</span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </motion.button>
              )}

              {/* Final slide completed celebration */}
              {isSlideNarrationComplete && currentStepIndex >= timeline.length - 1 && (
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/90 text-white font-bold text-xs md:text-sm shadow-[0_0_15px_rgba(16,185,129,0.5)] ring-2 ring-emerald-300"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Lesson Complete! 🎉</span>
                </motion.div>
              )}

              {/* Step Counter Pill */}
              <div className="flex items-center bg-slate-800 rounded-full p-1 border border-slate-700 shadow-sm">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={currentStepIndex <= 0}
                  className="p-1.5 rounded-full hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
                  title="Previous Slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold px-3 text-amber-300">
                  Slide {currentStepIndex + 1} / {Math.max(1, timeline.length)}
                </span>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={currentStepIndex >= timeline.length - 1}
                  className={`p-1.5 rounded-full transition-all ${
                    isSlideNarrationComplete && currentStepIndex < timeline.length - 1
                      ? 'bg-cyan-400 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.9)] animate-pulse ring-2 ring-cyan-200 scale-110'
                      : 'hover:bg-slate-700 disabled:opacity-30 text-white'
                  }`}
                  title="Next Slide"
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

          </footer>

        </div>
      )}
    </div>
  );
}
