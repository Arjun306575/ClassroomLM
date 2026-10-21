import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Send, X, Loader2, Hand, Mic, Globe, Lock,
  Library, Maximize2, Minimize2, ChevronLeft, ChevronRight, Volume2,
  Sparkles, Award, BookOpen, ArrowRight, RotateCcw, CheckCircle2, RefreshCw, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { PreClassroom } from './PreClassroom';
import { InteractiveQuiz2D } from './InteractiveQuiz2D';
import { TeacherMascot2D } from './TeacherMascot2D';
import { FuturisticTeacher3D } from './FuturisticTeacher3D';
import { AiQuizGame } from './AiQuizGame';
import { useAuth } from '../firebase/authContext';
import { QuizQuestion } from '../types';

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

// 2D AI Teacher Mascot is now modularly implemented in TeacherMascot2D
const Mascot2D = TeacherMascot2D;

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
  const { getIdToken, currentUser, openAuthModal } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isDemo = Boolean(lessonData?.isDemoLesson);
  const [demoPromptMessage, setDemoPromptMessage] = useState<string | null>(null);
  const demoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerDemoRestriction = useCallback(() => {
    if (demoTimeoutRef.current) {
      clearTimeout(demoTimeoutRef.current);
    }
    setDemoPromptMessage("Please sign in to use this feature");
    demoTimeoutRef.current = setTimeout(() => {
      setDemoPromptMessage(null);
    }, 4500);
  }, []);

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

  // Interactive Lesson Quiz States (3-5 Questions related to lesson explained)
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isMiniGameActive, setIsMiniGameActive] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentGainNodeRef = useRef<GainNode | null>(null);
  const lineTimersRef = useRef<NodeJS.Timeout[]>([]);
  const isMountedRef = useRef(true);
  const playbackSessionIdRef = useRef<number>(0);
  const initializedLessonIdRef = useRef<string | null>(null);

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

  // Global mount/unmount audio killer & 100% Ad-Free Classroom guarantee
  useEffect(() => {
    isMountedRef.current = true;

    // Ad-Free Guarantee: completely remove any residual Adsterra floating overlays or scripts
    const adsterraSelectors = [
      '[id*="adsterra"]',
      '[class*="adsterra"]',
      '[id*="at-cv-lightbox"]',
      '.at-cv-overlay',
      '[class*="at-cv"]',
      'div[style*="z-index: 2147483647"]',
      'div[style*="z-index: 9999999"]',
      'iframe[src*="bauval.org"]'
    ];
    document.querySelectorAll(adsterraSelectors.join(', ')).forEach(el => {
      try {
        if (el.id !== 'root' && !el.closest('#root')) {
          el.remove();
        }
      } catch (e) {}
    });

    return () => {
      isMountedRef.current = false;
      playbackSessionIdRef.current++;
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
    const sessionId = playbackSessionIdRef.current;
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
    if (sentences.length > 0 && playbackSessionIdRef.current === sessionId) {
      setCaptionLine(sentences[0]);
    }

    try {
      let base64Wav = preCachedBase64Wav;

      if (!base64Wav) {
        // STRICT RULE: Never generate TTS again and again in demo or saved lessons!
        const isSavedOrDemo = Boolean(lessonData?.isDemoLesson || lessonData?.isLoadedFromSaved || lessonData?.loadedFromSaved);
        if (isSavedOrDemo) {
          throw new Error("Demo and saved lessons use pre-saved TTS audio without generating TTS again.");
        }

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

        if (!isMountedRef.current || playbackSessionIdRef.current !== sessionId) return;
        if (!res.ok) throw new Error("TTS fetch returned non-200");

        const json = await res.json();
        base64Wav = json.audio || json.audioContent;
      }

      if (!base64Wav || !isMountedRef.current || playbackSessionIdRef.current !== sessionId) return;

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
      if (!isMountedRef.current || playbackSessionIdRef.current !== sessionId) return;

      // Clean Audio PCM Smoothing: eliminate clicks, pops, DC offset, and trailing static noise
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        const totalSamples = channelData.length;

        // 1. Smooth 15ms fade-in to prevent startup pop
        const fadeInSamples = Math.min(Math.floor(audioBuffer.sampleRate * 0.015), Math.floor(totalSamples * 0.05));
        for (let i = 0; i < fadeInSamples; i++) {
          channelData[i] *= (i / fadeInSamples);
        }

        // 2. Scan backwards to locate the true end of audible speech (eliminating trailing digital static / DC offset)
        let lastAudibleIdx = totalSamples - 1;
        for (let i = totalSamples - 1; i >= 0; i--) {
          if (Math.abs(channelData[i]) > 0.005) {
            lastAudibleIdx = i;
            break;
          }
        }

        // Allow 60ms natural decay, then taper smoothly to zero
        const decayEndIdx = Math.min(totalSamples, lastAudibleIdx + Math.floor(audioBuffer.sampleRate * 0.06));
        const fadeDuration = Math.min(Math.floor(audioBuffer.sampleRate * 0.12), decayEndIdx);
        const fadeStartIdx = Math.max(0, decayEndIdx - fadeDuration);

        for (let i = fadeStartIdx; i < decayEndIdx; i++) {
          const progress = (i - fadeStartIdx) / (decayEndIdx - fadeStartIdx);
          const factor = 0.5 * (1 + Math.cos(Math.PI * progress));
          channelData[i] *= factor;
        }

        // 3. Strictly zero all trailing samples to guarantee absolute 0V digital silence
        for (let i = decayEndIdx; i < totalSamples; i++) {
          channelData[i] = 0;
        }
      }

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

      // Anti-cracking GainNode envelope: smooth gentle fade-out well before end of audio buffer
      const gainNode = ctx.createGain();
      const startTime = ctx.currentTime;
      gainNode.gain.setValueAtTime(1, startTime);
      const fadeOutStart = Math.max(0, audioBuffer.duration - 0.22);
      gainNode.gain.setValueAtTime(1, startTime + fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, startTime + Math.max(fadeOutStart + 0.01, audioBuffer.duration - 0.04));
      gainNode.gain.setValueAtTime(0, startTime + audioBuffer.duration);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      if (analyserRef.current) {
        gainNode.connect(analyserRef.current);
      }
      currentGainNodeRef.current = gainNode;

      source.onended = () => {
        if (isMountedRef.current && playbackSessionIdRef.current === sessionId) {
          setMascotPose('neutral');
          setIsSpeaking(false);
          setIsSlideNarrationComplete(true);
        }
        // Delayed, non-blocking cleanup so Web Audio render pipeline completes with zero transients
        setTimeout(() => {
          try {
            source.disconnect();
            gainNode.disconnect();
          } catch (e) {}
        }, 250);
      };

      currentAudioSourceRef.current = source;
      source.start(0);

      const durationMs = audioBuffer.duration * 1000;
      const sentenceInterval = durationMs / Math.max(1, sentences.length);

      // Schedule line-by-line captions synced to audio duration
      sentences.forEach((s, idx) => {
        if (idx === 0) return;
        const timer = setTimeout(() => {
          if (!isMountedRef.current || playbackSessionIdRef.current !== sessionId) return;
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
      if (isMountedRef.current && playbackSessionIdRef.current === sessionId) {
        setIsSpeaking(false);
        setIsSlideNarrationComplete(true);
        setActiveBulletIndex(-1);
        setRevealedBulletCount(bulletPointsToSync ? bulletPointsToSync.length : 10);
      }

    } catch (err) {
      if (!isMountedRef.current || playbackSessionIdRef.current !== sessionId) return;
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
            if (isMountedRef.current && playbackSessionIdRef.current === sessionId) {
              setMascotPose('explaining');
              setIsSpeaking(true);
              setIsSlideNarrationComplete(false);
            }
          };
          utterance.onend = () => {
            if (isMountedRef.current && playbackSessionIdRef.current === sessionId) {
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
        if (!isMountedRef.current || playbackSessionIdRef.current !== sessionId) return;
        setCaptionLine(sentences[i]);
        if (bulletPointsToSync && bulletPointsToSync.length > 0) {
          const bIdx = Math.min(i, bulletPointsToSync.length - 1);
          setActiveBulletIndex(bIdx);
          setRevealedBulletCount(prev => Math.max(prev, bIdx + 1));
        }
        await new Promise(r => setTimeout(r, 2600));
        if (!isMountedRef.current || playbackSessionIdRef.current !== sessionId) return;
      }
      if (isMountedRef.current && playbackSessionIdRef.current === sessionId) {
        setMascotPose('happy');
        setIsSpeaking(false);
        setIsSlideNarrationComplete(true);
        setActiveBulletIndex(-1);
        setRevealedBulletCount(bulletPointsToSync ? bulletPointsToSync.length : 10);
      }
    }
  }, [currentVoiceConfig, lessonData]);

  // Load and apply a specific step from the lesson timeline
  const applyTimelineStep = useCallback(async (step: any, stepIdx: number, total: number) => {
    const sessionId = ++playbackSessionIdRef.current;
    setIsSlideNarrationComplete(false);
    setIsSpeaking(false);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (currentAudioSourceRef.current) {
      try { 
        currentAudioSourceRef.current.onended = null;
        currentAudioSourceRef.current.stop(); 
      } catch(e){}
      currentAudioSourceRef.current = null;
    }
    clearCaptionTimers();

    setIsChalkWiping(true);
    setTimeout(() => {
      if (isMountedRef.current && playbackSessionIdRef.current === sessionId) {
        setIsChalkWiping(false);
      }
    }, 900);

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
    if (spoken && isMountedRef.current && playbackSessionIdRef.current === sessionId) {
      await playAudioWithEmotion(spoken, rawBullets, step.ttsAudio);
    } else if (isMountedRef.current && playbackSessionIdRef.current === sessionId) {
      setIsSpeaking(false);
      setIsSlideNarrationComplete(true);
      setActiveBulletIndex(-1);
      setRevealedBulletCount(rawBullets.length);
    }
  }, [playAudioWithEmotion, lessonData]);

  /**
   * Fresh Quiz Generator for Lessons
   * Always synthesizes fresh, relevant assessment questions related directly to the lesson explained.
   * Runs freshly whenever a saved lesson is played or when explicitly requested.
   */
  const fetchFreshQuiz = useCallback(async (customTimeline?: any[]) => {
    if (!isMountedRef.current) return;
    setIsQuizLoading(true);
    try {
      const activeTimeline = customTimeline || timeline;
      const topic = lessonData?.config?.topic || lessonData?.title || boardHeading || "Lesson Topic";
      const language = currentLanguage || "English";
      const gradeLevel = lessonData?.config?.classLevel || "Class 10";

      // Extract comprehensive summary of what was actually explained across the slides
      let lessonSummary = "";
      if (Array.isArray(activeTimeline) && activeTimeline.length > 0) {
        lessonSummary = activeTimeline.map((step: any, idx: number) => {
          const heading = step.whiteboardContent?.heading || `Slide ${idx + 1}`;
          const bullets = Array.isArray(step.whiteboardContent?.bulletPoints)
            ? step.whiteboardContent.bulletPoints.join('; ')
            : '';
          const dialogue = step.spokenDialogue || step.bubbleCaption || '';
          return `Slide ${idx + 1} (${heading}): ${bullets}. Spoken explanation: ${dialogue}`;
        }).join('\n\n');
      }

      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          language,
          gradeLevel,
          lessonSummary: lessonSummary || `Core foundations, mechanisms, equations, and applications of ${topic}`,
          count: 4
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (isMountedRef.current && Array.isArray(data.quiz) && data.quiz.length >= 3) {
          setQuizQuestions(data.quiz.slice(0, 5));
          return;
        }
      }
    } catch (err) {
      console.warn("[LiveClassroom] Failed to fetch fresh quiz:", err);
    } finally {
      if (isMountedRef.current) {
        setIsQuizLoading(false);
      }
    }
  }, [timeline, lessonData, boardHeading, currentLanguage]);

  const handleQuizSubmit = (score: number, total: number) => {
    setMascotPose(score === total ? "celebrating" : score >= total * 0.7 ? "happy" : "explaining");
    setCaptionLine(`Quiz completed! You scored ${score} out of ${total}. Review explanations below.`);
  };

  const handleRetakeQuiz = () => {
    setMascotPose("thinking");
    setCaptionLine("Retaking quiz! Answer each question thoughtfully.");
  };

  const handleGenerateFreshQuiz = () => {
    setMascotPose("explaining");
    setCaptionLine("Generating fresh assessment questions for this lesson...");
    fetchFreshQuiz();
  };

  // Initial startup: generate or load lesson steps exactly once per lesson
  useEffect(() => {
    const lessonKey = lessonData?.id || lessonData?.title || 'active-lesson';
    if (initializedLessonIdRef.current === lessonKey) {
      return;
    }
    initializedLessonIdRef.current = lessonKey;

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

      if (isDemo || isFromSaved || (existingTimeline && Array.isArray(existingTimeline) && existingTimeline.length > 0)) {
        // STRICT REQUIREMENT: If loaded from Demo or Saved Content, NEVER GENERATE AGAIN!
        // Immediately load the saved timeline into state and display slide 1
        const timelineToUse = (existingTimeline && Array.isArray(existingTimeline) && existingTimeline.length > 0)
          ? existingTimeline
          : (lessonData?.timeline || [
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
            ]);

        setTimeline(timelineToUse);
        setCurrentStepIndex(0);
        await applyTimelineStep(timelineToUse[0], 0, timelineToUse.length);

        // If Demo lesson, use permanent interactive quiz tied to lesson directly (0ms latency, no API call)
        if (isDemo && Array.isArray(lessonData?.quiz) && lessonData.quiz.length > 0) {
          setQuizQuestions(lessonData.quiz);
        } else {
          // Fresh Quiz Generation for regular Saved Lessons
          fetchFreshQuiz(timelineToUse);
        }
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
            if (Array.isArray(data.quiz) && data.quiz.length >= 3) {
              setQuizQuestions(data.quiz.slice(0, 5));
            } else {
              fetchFreshQuiz(data.timeline);
            }
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
        fetchFreshQuiz(fallbackSteps);
      }
    };

    initLesson();
  }, [lessonData, currentLanguage, currentVoiceConfig, applyTimelineStep, fetchFreshQuiz]);

  const handleReplayCurrentSlide = () => {
    if (timeline[currentStepIndex]) {
      applyTimelineStep(timeline[currentStepIndex], currentStepIndex, timeline.length);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (currentAudioSourceRef.current) {
        try {
          currentAudioSourceRef.current.onended = null;
          currentAudioSourceRef.current.stop();
        } catch (e) {}
        currentAudioSourceRef.current = null;
      }
      clearCaptionTimers();
      setIsSpeaking(false);
      setIsSlideNarrationComplete(false);

      const newIdx = currentStepIndex - 1;
      setCurrentStepIndex(newIdx);
      if (timeline[newIdx]) {
        applyTimelineStep(timeline[newIdx], newIdx, timeline.length);
      }
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < timeline.length - 1) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (currentAudioSourceRef.current) {
        try {
          currentAudioSourceRef.current.onended = null;
          currentAudioSourceRef.current.stop();
        } catch (e) {}
        currentAudioSourceRef.current = null;
      }
      clearCaptionTimers();
      setIsSpeaking(false);
      setIsSlideNarrationComplete(false);

      const newIdx = currentStepIndex + 1;
      setCurrentStepIndex(newIdx);
      if (timeline[newIdx]) {
        applyTimelineStep(timeline[newIdx], newIdx, timeline.length);
      }
    }
  };

  // Student asking a doubt
  const submitQuestionText = async (doubtQuestion: string) => {
    if (!doubtQuestion.trim()) return;
    if (isDemo && !currentUser) {
      triggerDemoRestriction();
      return;
    }
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
    if (isDemo && !currentUser) {
      triggerDemoRestriction();
      return;
    }
    submitQuestionText(askText);
  };

  // Raise hand to speak a question
  const handleRaiseHand = async () => {
    if (isDemo && !currentUser) {
      triggerDemoRestriction();
      return;
    }
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

            {/* Center Switcher: Slides vs Quiz */}
            <div className="flex items-center bg-slate-800/90 rounded-full p-0.5 sm:p-1 border border-slate-700/80 shadow-inner">
              <button
                type="button"
                onClick={() => setIsQuizActive(false)}
                className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 ${
                  !isQuizActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="View lesson blackboard slides"
              >
                <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden xs:inline">Slides</span>
                <span>({currentStepIndex + 1}/{Math.max(1, timeline.length)})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsQuizActive(true);
                  if (quizQuestions.length === 0 && !isQuizLoading) {
                    fetchFreshQuiz();
                  }
                }}
                className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 ${
                  isQuizActive
                    ? 'bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 font-black shadow-md'
                    : currentStepIndex >= timeline.length - 1
                    ? 'bg-cyan-500/20 text-cyan-300 hover:text-white border border-cyan-400/40 animate-pulse'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Take 3-5 assessment questions based on this lesson"
              >
                <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Quiz</span>
                {quizQuestions.length > 0 && (
                  <span className="text-[10px] opacity-80">({quizQuestions.length} Qs)</span>
                )}
              </button>
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

            {/* Futuristic Advanced 3D AI Teacher Character (Left Column) */}
            <aside className="relative z-10 w-44 sm:w-52 md:w-60 lg:w-72 shrink-0 h-full flex flex-col items-center justify-end pb-3 select-none">
              <FuturisticTeacher3D pose={mascotPose} isSpeaking={isSpeaking} analyserRef={analyserRef} />
              <div className="mt-1 text-center flex flex-col items-center gap-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)] text-cyan-300">
                  <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                  <span className="text-[10px] sm:text-[11px] font-black tracking-wider uppercase">
                    {isSpeaking ? 'Explaining Lesson' : 'Quantum AI Teacher'}
                  </span>
                </div>
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
                {isQuizActive ? (
                  <InteractiveQuiz2D
                    questions={quizQuestions}
                    isLoading={isQuizLoading}
                    topic={lessonData?.title || boardHeading || "Lesson Quiz"}
                    isDarkMode={isDarkMode}
                    onSubmitQuiz={handleQuizSubmit}
                    onRetakeQuiz={handleRetakeQuiz}
                    onGenerateFreshQuiz={handleGenerateFreshQuiz}
                    onReturnToSlides={() => setIsQuizActive(false)}
                    onLaunchMiniGame={() => setIsMiniGameActive(true)}
                  />
                ) : (
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
                )}
              </div>
            </section>
          </main>

          {/* DEDICATED LIVE SUBTITLES HUD - AMPLE VERTICAL SPACING PREVENTS ANY COLLISION WITH BOTTOM ACTION BAR */}
          <div className="w-full flex justify-center px-4 pt-1 sm:pt-2 pb-3.5 sm:pb-4 mb-2 sm:mb-3 z-30 pointer-events-none shrink-0">
            <AnimatePresence mode="wait">
              {captionLine && (
                <motion.div 
                  key={captionLine}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-2xl sm:max-w-3xl pointer-events-auto px-5 sm:px-6 py-2.5 sm:py-3 bg-slate-950/95 backdrop-blur-xl rounded-2xl border border-cyan-500/40 shadow-[0_12px_35px_rgba(0,0,0,0.9)] flex items-center justify-center text-center ring-1 ring-cyan-500/20"
                >
                  <p className="text-xs sm:text-sm font-medium text-white/95 leading-relaxed tracking-wide text-center line-clamp-2">
                    {captionLine}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Non-intrusive Demo Mode Toast Notification */}
          <AnimatePresence>
            {demoPromptMessage && (
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="fixed bottom-28 sm:bottom-32 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-slate-900/95 border border-amber-500/60 text-white shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl pointer-events-auto max-w-[92vw]"
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs sm:text-sm font-bold text-slate-100">
                    {demoPromptMessage}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-400">
                    Live doubts and interactive voice Q&A require signing in.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDemoPromptMessage(null);
                    openAuthModal("Please sign in to use this feature");
                  }}
                  className="ml-1 sm:ml-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setDemoPromptMessage(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-white transition-colors shrink-0"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* DOCKED BOTTOM CONTROL BAR: Raise Hand, Doubt Box, Slide Navigation, Replay */}
          <footer className="relative w-full bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl px-3 sm:px-6 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 z-40 shrink-0 shadow-[0_-10px_35px_rgba(0,0,0,0.5)]">
            
            {/* Left Action Buttons: Raise Hand & Replay Voice */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              {/* Raise Hand: Voice Doubt input */}
              <button
                type="button"
                onClick={handleRaiseHand}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full font-bold text-xs md:text-sm transition-all shadow-lg active:scale-95 ${
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

            {/* Center: Ask Question / Doubt Input Bar (Spans full width on mobile phones to prevent congestion) */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (isDemo && !currentUser) {
                  triggerDemoRestriction();
                  return;
                }
                submitQuestion(e);
              }} 
              className="w-full sm:w-auto sm:flex-1 max-w-xl min-w-0 sm:min-w-[220px] order-last sm:order-none relative"
            >
              <input 
                type="text"
                value={askText}
                onFocus={(e) => {
                  if (isDemo && !currentUser) {
                    e.preventDefault();
                    e.target.blur();
                    triggerDemoRestriction();
                  }
                }}
                onClick={(e) => {
                  if (isDemo && !currentUser) {
                    e.preventDefault();
                    triggerDemoRestriction();
                  }
                }}
                onKeyDown={(e) => {
                  if (isDemo && !currentUser) {
                    e.preventDefault();
                    triggerDemoRestriction();
                  }
                }}
                onChange={(e) => {
                  if (isDemo && !currentUser) {
                    triggerDemoRestriction();
                    return;
                  }
                  setAskText(e.target.value);
                }}
                placeholder="Ask any question or doubt about this slide..."
                disabled={isAnsweringDoubt}
                className="w-full bg-slate-800/90 hover:bg-slate-800 focus:bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-full px-5 py-2.5 pr-12 text-xs md:text-sm text-white placeholder-slate-400 focus:outline-none transition-all shadow-inner disabled:opacity-50"
              />
              <button 
                type="submit" 
                onClick={(e) => {
                  if (isDemo && !currentUser) {
                    e.preventDefault();
                    triggerDemoRestriction();
                  }
                }}
                disabled={(!askText.trim() && !(isDemo && !currentUser)) || isAnsweringDoubt}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-full transition-colors cursor-pointer"
                title="Send Question"
              >
                {isAnsweringDoubt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </form>

            {/* Right: Slide Step Navigation */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Next Slide button: Only shown once current slide narration is completely finished and teacher is NOT speaking */}
              {!isSpeaking && isSlideNarrationComplete && currentStepIndex < timeline.length - 1 && !isQuizActive && (
                <motion.button
                  type="button"
                  onClick={handleNextStep}
                  animate={{ 
                    scale: [1, 1.04, 1],
                    boxShadow: [
                      "0 0 6px rgba(34,211,238,0.4)",
                      "0 0 20px rgba(34,211,238,0.8)",
                      "0 0 6px rgba(34,211,238,0.4)"
                    ]
                  }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-slate-950 font-black text-xs md:text-sm shadow-xl ring-2 ring-cyan-200 cursor-pointer"
                  title="Advance to next slide"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-current text-amber-200" />
                  <span className="tracking-wide">Next Slide</span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </motion.button>
              )}

              {/* End of Lesson: Prominent CTAs for Beat the Bot Mini-Game and Lesson Quiz */}
              {!isQuizActive && currentStepIndex >= timeline.length - 1 && !isSpeaking && (
                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={() => {
                      if (quizQuestions.length === 0 && !isQuizLoading) {
                        fetchFreshQuiz();
                      }
                      setIsMiniGameActive(true);
                    }}
                    animate={{ 
                      scale: [1, 1.04, 1],
                      boxShadow: [
                        "0 0 10px rgba(245,158,11,0.5)",
                        "0 0 24px rgba(236,72,153,0.8)",
                        "0 0 10px rgba(245,158,11,0.5)"
                      ]
                    }}
                    transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }}
                    className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 via-pink-500 to-indigo-500 hover:from-amber-300 hover:to-indigo-400 text-slate-950 font-black text-xs md:text-sm shadow-xl ring-2 ring-amber-300 cursor-pointer"
                    title="Play 60s Beat the Bot rapid-fire trivia to unlock 2 free AI Searches!"
                  >
                    <Zap className="w-4 h-4 fill-current text-slate-950" />
                    <span className="tracking-wide">Beat the Bot (60s)</span>
                    <Sparkles className="w-3.5 h-3.5 fill-current text-slate-950" />
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => {
                      setIsQuizActive(true);
                      if (quizQuestions.length === 0 && !isQuizLoading) {
                        fetchFreshQuiz();
                      }
                    }}
                    animate={{ 
                      scale: [1, 1.05, 1],
                      boxShadow: [
                        "0 0 10px rgba(34,211,238,0.5)",
                        "0 0 26px rgba(34,211,238,0.9)",
                        "0 0 10px rgba(34,211,238,0.5)"
                      ]
                    }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-slate-950 font-black text-xs md:text-sm shadow-xl ring-2 ring-cyan-200 cursor-pointer"
                    title="Lesson complete! Take 3-5 assessment questions related to this lesson"
                  >
                    <Award className="w-4 h-4 fill-current text-indigo-950" />
                    <span className="tracking-wide">Lesson Quiz ({quizQuestions.length > 0 ? quizQuestions.length : '3–5'} Qs)</span>
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </motion.button>
                </div>
              )}

              {/* While in Quiz view: Button to Return to Slides */}
              {isQuizActive && (
                <button
                  type="button"
                  onClick={() => setIsQuizActive(false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs md:text-sm border border-slate-700 shadow-md transition-all active:scale-95"
                  title="Return to review blackboard slides"
                >
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>Review Slides</span>
                </button>
              )}

              {/* Step Counter Pill */}
              <div className="flex items-center bg-slate-800 rounded-full p-1 border border-slate-700 shadow-sm">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={currentStepIndex <= 0 || isSpeaking}
                  className="p-1.5 rounded-full hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
                  title={isSpeaking ? "Narration in progress..." : "Previous Slide"}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold px-3 text-amber-300">
                  Slide {currentStepIndex + 1} / {Math.max(1, timeline.length)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (currentStepIndex >= timeline.length - 1) {
                      setIsQuizActive(true);
                      if (quizQuestions.length === 0 && !isQuizLoading) {
                        fetchFreshQuiz();
                      }
                    } else {
                      handleNextStep();
                    }
                  }}
                  disabled={isSpeaking}
                  className={`p-1.5 rounded-full transition-all ${
                    isSpeaking 
                      ? 'opacity-40 cursor-not-allowed hover:bg-transparent'
                      : currentStepIndex >= timeline.length - 1 && !isQuizActive
                      ? 'bg-cyan-400 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.9)] animate-pulse ring-2 ring-cyan-200 scale-105'
                      : isSlideNarrationComplete && currentStepIndex < timeline.length - 1
                      ? 'bg-cyan-400 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.9)] ring-2 ring-cyan-200 scale-105'
                      : 'hover:bg-slate-700 disabled:opacity-30 text-white'
                  }`}
                  title={isSpeaking ? "Narration in progress..." : (currentStepIndex >= timeline.length - 1 ? "Advance to Lesson Quiz" : "Next Slide")}
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

          </footer>

        </div>
      )}

      {/* 60s Rapid-Fire AI Quiz Show: Beat the Bot! Mini-Game Modal */}
      {isMiniGameActive && (
        <AiQuizGame
          questions={
            quizQuestions.length > 0 
              ? quizQuestions 
              : (Array.isArray(lessonData?.data?.quiz) && lessonData.data.quiz.length > 0)
              ? lessonData.data.quiz
              : [
                  {
                    question: `What is the core principle of ${lessonData?.title || boardHeading || "this lesson"}?`,
                    options: [
                      "Fundamental scientific mechanisms and definitions",
                      "Unrelated arbitrary observations",
                      "Non-functional static description",
                      "Alternative unverified speculation"
                    ],
                    correctIndex: 0,
                    explanation: `Core principles govern the mechanisms of ${lessonData?.title || boardHeading || "this topic"}.`
                  },
                  {
                    question: `Why is understanding ${lessonData?.title || boardHeading || "this topic"} essential?`,
                    options: [
                      "It has no practical relevance",
                      "It enables systematic analysis and problem-solving",
                      "It only works in theoretical models",
                      "It is obsolete"
                    ],
                    correctIndex: 1,
                    explanation: "Mastering this concept enables predictive modeling and systematic analysis."
                  },
                  {
                    question: "Which approach is most effective when analyzing problems in this lesson?",
                    options: [
                      "Random guessing without checking principles",
                      "Breaking complex systems into first principles",
                      "Ignoring system boundary conditions",
                      "Relying solely on intuition"
                    ],
                    correctIndex: 1,
                    explanation: "First-principles component breakdown is the gold standard for analytical reasoning."
                  },
                  {
                    question: "What primary factor drives key transformations across this system?",
                    options: [
                      "Energy interactions and governing mechanisms",
                      "Arbitrary background noise",
                      "Uncalibrated fluctuations",
                      "Total absence of external variables"
                    ],
                    correctIndex: 0,
                    explanation: "Energy gradients and interaction dynamics drive transformations across the system."
                  },
                  {
                    question: "What is the key takeaway students should master?",
                    options: [
                      "Deep comprehension of underlying mechanisms and applications",
                      "Rote memorization without understanding",
                      "Skipping validation steps",
                      "Disregarding foundational laws"
                    ],
                    correctIndex: 0,
                    explanation: "Deep conceptual comprehension and understanding boundary constraints ensure mastery."
                  }
                ]
          }
          topic={lessonData?.title || boardHeading || "Lesson Review"}
          onClose={() => setIsMiniGameActive(false)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
