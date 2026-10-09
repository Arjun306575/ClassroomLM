import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TimelineStep, WhiteboardContent } from "../types";
import { Volume2, VolumeX, Sparkles, BookOpen, GraduationCap, Maximize2, Minimize2, Hand, Loader2, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface ClassroomSceneProps {
  currentStep: TimelineStep | null;
  isPlaying: boolean;
  onPauseToggle: () => void;
  onStepChange: (index: number) => void;
  currentStepIndex: number;
  totalSteps: number;
  interruptedDoubt: {
    dialogue: string;
    gesture: string;
    whiteboard: WhiteboardContent;
    transitionBack: string;
  } | null;
  onResolveInterruption: () => void;
  language: string;
  onDialogueComplete?: () => void;
  isDarkMode?: boolean;
  isRateLimited?: boolean;
  remainingSeconds?: number;
  trackRequest?: () => boolean;

  // Raise Hand / Voice Doubt Interruption Props
  isListening?: boolean;
  toggleListening?: () => void;
  isResolvingDoubt?: boolean;
  doubtText?: string;
  setDoubtText?: (text: string) => void;
  submitDoubt?: () => void;
  isWaitingForUserVoice?: boolean;
  onDoubtPromptComplete?: () => void;

  // Timeline prop for steps list
  timeline?: TimelineStep[];

  // Custom Avatar Styling Props
  avatarSkinColor?: string;
  avatarOutfitColor?: string;
  avatarHairColor?: string;
  avatarHairStyle?: string;
  avatarGlassesColor?: string;
  gender?: "male" | "female";
  teacherVoice?: string;
  onVoiceChange?: (voice: string) => void;
  onFullscreenChange?: (fullscreen: boolean) => void;
}


const audioQueue: { text: string; language: string; onStart: () => void; onEnd: () => void }[] = [];
let isPlayingQueue = false;

function processAudioQueue() {
  if (audioQueue.length === 0) {
    isPlayingQueue = false;
    return;
  }
  isPlayingQueue = true;
  const { text, language, onStart, onEnd } = audioQueue.shift();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  
  const voices = window.speechSynthesis.getVoices();
  const targetVoice = voices.find(v => v.lang.includes(language) || v.lang.includes('en'));
  if (targetVoice) utterance.voice = targetVoice;

  utterance.onstart = onStart;
  utterance.onend = () => {
    onEnd();
    processAudioQueue();
  };
  utterance.onerror = () => {
    onEnd();
    processAudioQueue();
  };
  
  window.speechSynthesis.speak(utterance);
}

function speakLessonFallback(text: string, language = 'en-US', onStart: () => void, onEnd: () => void) {
  if (!('speechSynthesis' in window)) {
    onEnd();
    return;
  }
  
  audioQueue.push({ text, language, onStart, onEnd });
  if (!isPlayingQueue) {
    window.speechSynthesis.cancel();
    processAudioQueue();
  }
}

export default function ClassroomScene({
  currentStep,
  isPlaying,
  onPauseToggle,
  onStepChange,
  currentStepIndex,
  totalSteps,
  interruptedDoubt,
  onResolveInterruption,
  language,
  onDialogueComplete,
  isDarkMode = false,
  isRateLimited = false,
  remainingSeconds = 0,
  trackRequest,

  // Doubt interruption defaults
  isListening = false,
  toggleListening = () => {},
  isResolvingDoubt = false,
  doubtText = "",
  setDoubtText = () => {},
  submitDoubt = () => {},
  isWaitingForUserVoice = false,
  onDoubtPromptComplete = () => {},

  // Timeline default
  timeline = [],

  // Custom Avatar Styling defaults
  avatarSkinColor = "#fed7aa",
  avatarOutfitColor = "#4f46e5",
  avatarHairColor = "#78350f",
  avatarHairStyle = "smart",
  avatarGlassesColor = "#ef4444",
  gender = "female",
  teacherVoice = "Aoede",
  onVoiceChange = () => {},
  onFullscreenChange,
}: ClassroomSceneProps) {
  const onDialogueCompleteRef = useRef(onDialogueComplete);
  const onResolveInterruptionRef = useRef(onResolveInterruption);
  const onDoubtPromptCompleteRef = useRef(onDoubtPromptComplete);
  const isWaitingForUserVoiceRef = useRef(isWaitingForUserVoice);
  const isListeningRef = useRef(isListening);

  useEffect(() => {
    onDialogueCompleteRef.current = onDialogueComplete;
    onResolveInterruptionRef.current = onResolveInterruption;
    onDoubtPromptCompleteRef.current = onDoubtPromptComplete;
    isWaitingForUserVoiceRef.current = isWaitingForUserVoice;
    isListeningRef.current = isListening;
  }, [onDialogueComplete, onResolveInterruption, onDoubtPromptComplete, isWaitingForUserVoice, isListening]);

  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [typedDialogue, setTypedDialogue] = useState("");
  const [bubbleLanguage, setBubbleLanguage] = useState<"native" | "english">("native");
  const [liveVoiceProfile, setLiveVoiceProfile] = useState<string>("Aoede");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [activeStepToRender, setActiveStepToRender] = useState<TimelineStep | null>(null);
  const [isStaringBoard, setIsStaringBoard] = useState(false);
  const [isErasingBoard, setIsErasingBoard] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBoardFocused, setIsBoardFocused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  const containerRef = useRef<HTMLDivElement>(null);
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(err => {
          console.error("Error attempting to enable fullscreen:", err);
        });
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.error("Error attempting to disable fullscreen:", err);
        });
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);
  const [hoveredWord, setHoveredWord] = useState<{
    word: string;
    rect: DOMRect | null;
  } | null>(null);
  const [definitionsCache, setDefinitionsCache] = useState<{
    [word: string]: {
      loading: boolean;
      definition?: string;
      partOfSpeech?: string;
      phonetic?: string;
      error?: boolean;
    };
  }>({});

  const fetchDefinition = async (word: string) => {
    const cleanWord = word.toLowerCase().trim();
    if (!cleanWord) return;

    setDefinitionsCache(prev => ({
      ...prev,
      [cleanWord]: { loading: true }
    }));

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
      if (!res.ok) {
        throw new Error("Word not found");
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const entry = data[0];
        const phonetic = entry.phonetic || (entry.phonetics && entry.phonetics.find((p: any) => p.text)?.text) || "";
        const meaning = entry.meanings && entry.meanings[0];
        const partOfSpeech = meaning ? meaning.partOfSpeech : "";
        const definition = meaning && meaning.definitions && meaning.definitions[0]?.definition || "No definition available.";
        
        setDefinitionsCache(prev => ({
          ...prev,
          [cleanWord]: {
            loading: false,
            phonetic,
            partOfSpeech,
            definition
          }
        }));
      } else {
        throw new Error("No entries found");
      }
    } catch (error) {
      setDefinitionsCache(prev => ({
        ...prev,
        [cleanWord]: {
          loading: false,
          error: true,
          definition: "We couldn't find a dictionary definition for this word."
        }
      }));
    }
  };

  const handleWordMouseEnter = (word: string, event: React.MouseEvent<HTMLSpanElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const cleanWord = word.toLowerCase().replace(/[^a-zA-Z-]/g, "");
    
    if (!cleanWord || cleanWord.length < 2) return;

    setHoveredWord({
      word: cleanWord,
      rect: rect
    });

    if (!definitionsCache[cleanWord]) {
      fetchDefinition(cleanWord);
    }
  };

  const handleWordMouseLeave = () => {
    setHoveredWord(null);
  };

  const renderTextWithHoverableWords = (text: string, isWhiteboard: boolean = false) => {
    if (!text) return "";

    const isComplexWord = (w: string) => {
      const clean = w.toLowerCase().replace(/[^a-zA-Z]/g, "");
      if (clean.length < 6) return false;
      
      const commonWords = new Set([
        "about", "would", "their", "there", "these", "those", "which", "where", "while", "after", "before", 
        "under", "other", "first", "second", "every", "great", "small", "large", "could", "should", "would", 
        "people", "using", "called", "through", "during", "around", "between", "about", "right", "under", "above",
        "learn", "learned", "learning", "classroom", "teacher", "student", "subject", "lesson", "write", "about",
        "water", "plants", "green", "light", "atoms", "force", "speed", "years"
      ]);
      
      return !commonWords.has(clean);
    };

    const parts = text.split(/(\s+)/);

    return parts.map((part, index) => {
      if (/^\s+$/.test(part)) {
        return <span key={index}>{part}</span>;
      }

      const match = part.match(/^([^a-zA-Z-]*)([a-zA-Z-]+)([^a-zA-Z-]*)$/);
      if (!match) {
        return <span key={index}>{part}</span>;
      }

      const [, leading, word, trailing] = match;
      const isComplex = isComplexWord(word);

      const underlineStyle = isWhiteboard
        ? "underline decoration-dashed decoration-teal-400/80 hover:text-teal-300 hover:decoration-teal-300"
        : "underline decoration-dashed decoration-indigo-500/80 hover:text-indigo-600 hover:decoration-indigo-600 dark:hover:text-indigo-400 dark:hover:decoration-indigo-400";

      return (
        <span key={index} className="inline-block whitespace-pre-wrap">
          {leading}
          <span
            onMouseEnter={(e) => handleWordMouseEnter(word, e)}
            onMouseLeave={handleWordMouseLeave}
            className={`cursor-help transition-all duration-150 ${isComplex ? `${underlineStyle} font-semibold` : "hover:text-indigo-500 dark:hover:text-indigo-400"}`}
          >
            {word}
          </span>
          {trailing}
        </span>
      );
    });
  };

  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
  }, [isFullscreen, onFullscreenChange]);

  useEffect(() => {
    if (teacherVoice) {
      setLiveVoiceProfile(teacherVoice);
    }
  }, [teacherVoice]);

  const GEMINI_LIVE_VOICES = {
    Aoede: { name: "Aoede (Balanced & Warm)", pitch: 1.0, rate: 0.95, type: "female", desc: "Clear and professional ma'm tone" },
    Puck: { name: "Puck (Bright & Playful)", pitch: 1.18, rate: 1.08, type: "male", desc: "Fast-paced, energetic sir tone" },
    Charon: { name: "Charon (Deep & Calm)", pitch: 0.82, rate: 0.88, type: "male", desc: "Resonant, slower sir tone" },
    Kore: { name: "Kore (Friendly & Active)", pitch: 1.12, rate: 0.98, type: "female", desc: "High-spirit, bright ma'm tone" },
    Fenrir: { name: "Fenrir (Energetic & Sharp)", pitch: 0.94, rate: 1.05, type: "male", desc: "Direct, confident sir tone" }
  };

  const activeStep = (interruptedDoubt
    ? {
        timestamp: "Doubt Resolution",
        teacherGesture: interruptedDoubt.gesture,
        spokenDialogue: interruptedDoubt.dialogue,
        bubbleCaption: interruptedDoubt.dialogue,
        translationText: interruptedDoubt.transitionBack,
        whiteboardContent: interruptedDoubt.whiteboard,
      }
    : currentStep) as TimelineStep;

  // Stare-then-erase transition logic to handle board changes physically and avoid scrolling
  useEffect(() => {
    if (!activeStep) {
      setActiveStepToRender(null);
      setIsStaringBoard(false);
      setIsErasingBoard(false);
      return;
    }

    if (!activeStepToRender) {
      setActiveStepToRender(activeStep);
      return;
    }

    // Check if whiteboard content actually changed or if we need to erase
    const contentChanged = 
      activeStepToRender.whiteboardContent.heading !== activeStep.whiteboardContent.heading ||
      JSON.stringify(activeStepToRender.whiteboardContent.bulletPoints) !== JSON.stringify(activeStep.whiteboardContent.bulletPoints);

    if (contentChanged) {
      const headingChanged = activeStepToRender.whiteboardContent.heading !== activeStep.whiteboardContent.heading;
      const prevBulletCount = activeStepToRender.whiteboardContent.bulletPoints.length;
      
      // Only erase if heading has changed AND the board had significant content (more than 2 bullets)
      const shouldErase = headingChanged && prevBulletCount > 2;

      if (shouldErase) {
        setIsStaringBoard(true);
        setIsErasingBoard(false);
        let eraseTimer: NodeJS.Timeout;

        const stareTimer = setTimeout(() => {
          setIsStaringBoard(false);
          setIsErasingBoard(true);

          eraseTimer = setTimeout(() => {
            setIsErasingBoard(false);
            setActiveStepToRender(activeStep);
          }, 1500);
        }, 1200);

        return () => {
          clearTimeout(stareTimer);
          clearTimeout(eraseTimer);
          setIsStaringBoard(false);
          setIsErasingBoard(false);
        };
      } else {
        // Update content directly without showing any erase/wipe sequence
        setActiveStepToRender(activeStep);
      }
    } else {
      setActiveStepToRender(activeStep);
    }
  }, [activeStep]);

  // Gemini TTS Effect mimicking Gemini Live voice naturally with automatic advancing
  useEffect(() => {
    let isCurrentEffectActive = true;
    if (!activeStepToRender) {
      setIsSpeaking(false);
      return;
    }

    // Determine target text
    const textToSpeak = bubbleLanguage === "english" && activeStepToRender.translationText
      ? activeStepToRender.translationText
      : activeStepToRender.spokenDialogue;

    // Fallback simulated duration in ms scaled by playbackSpeed
    const simulatedSpeakingTime = Math.max(2000, Math.min(13000, textToSpeak.length * 68)) / playbackSpeed;
    let fallbackTimer: NodeJS.Timeout | null = null;
    let fetchAborter: AbortController | null = null;

    // Stop speaking completely if lesson is paused AND not currently reading an interrupted doubt response
    // Also, NEVER speak if the microphone is currently active listening to the user!
    const shouldSpeak = (isPlaying || interruptedDoubt !== null) && !isListening && !isRateLimited;

    if (!shouldSpeak) {
      setIsSpeaking(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      return;
    }

    const triggerComplete = () => {
      setIsSpeaking(false);
      if (isWaitingForUserVoiceRef.current && onDoubtPromptCompleteRef.current) {
        onDoubtPromptCompleteRef.current();
      } else if (interruptedDoubt && !isWaitingForUserVoiceRef.current && onResolveInterruptionRef.current) {
        onResolveInterruptionRef.current();
      } else if (isPlaying && onDialogueCompleteRef.current && !interruptedDoubt) {
        onDialogueCompleteRef.current();
      }
    };

    if (isAudioOn) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      fetchAborter = new AbortController();
      
      const playTTS = async () => {
        try {
          setIsSpeaking(true);
          
          let audioData = "";
          const isTranslation = bubbleLanguage === "english" && activeStepToRender?.translationText;

          // Check if pre-cached audio is available on the timeline step
          if (!interruptedDoubt && activeStepToRender) {
            if (isTranslation && activeStepToRender.audioTranslationBase64) {
              audioData = activeStepToRender.audioTranslationBase64;
            } else if (!isTranslation && activeStepToRender.audioBase64) {
              audioData = activeStepToRender.audioBase64;
            }
          }

          // If no pre-cached audio, fetch from TTS API dynamically
          if (!audioData) {
            if (trackRequest && !trackRequest()) {
              // Rate limit triggered, shouldSpeak will become false on next render
              return;
            }
            const response = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: textToSpeak, voice: liveVoiceProfile }),
              signal: fetchAborter?.signal
            });
            
            if (!response.ok) {
              if (response.status === 429) throw new Error("429");
              throw new Error("TTS fetch failed");
            }
            const data = await response.json();
            audioData = data.audio;
          }
          
          if (!isCurrentEffectActive) return;
          
          const audio = new Audio(`data:audio/wav;base64,${audioData}`);
          audioRef.current = audio;
          audio.playbackRate = playbackSpeed;
          
          audio.onended = () => {
            if (!isCurrentEffectActive) return;
            triggerComplete();
          };
          
          audio.onerror = () => {
            if (!isCurrentEffectActive) return;
            fallbackTimer = setTimeout(triggerComplete, 1500);
          };
          
          await audio.play();
          setIsSpeaking(true);
        } catch (err: any) {
          if (err.name === "AbortError") return;
          console.warn("TTS playback failed:", err);
          if (!isCurrentEffectActive) return;
          // Use simulated timer instead of unreliable speechSynthesis
          setIsSpeaking(true);
          fallbackTimer = setTimeout(() => {
            if (!isCurrentEffectActive) return;
            triggerComplete();
          }, simulatedSpeakingTime);
        }
      };
      
      playTTS();
    } else {
      // Audio is off, run simulated speaking timer
      setIsSpeaking(true);
      fallbackTimer = setTimeout(() => {
        if (!isCurrentEffectActive) return;
        triggerComplete();
      }, simulatedSpeakingTime);
    }

    return () => {
      isCurrentEffectActive = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (fetchAborter) fetchAborter.abort();
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      setIsSpeaking(false);
    };
  }, [activeStepToRender?.spokenDialogue, activeStepToRender?.translationText, bubbleLanguage, isAudioOn, isPlaying, language, interruptedDoubt, liveVoiceProfile, playbackSpeed, isRateLimited, isListening]);

  // Sync spoken dialogue text-typing effect so it unfolds perfectly in sync with speech
  useEffect(() => {
    if (!activeStepToRender) return;
    setTypedDialogue("");
    
    const rawFullText = bubbleLanguage === "english" && activeStepToRender.translationText
      ? activeStepToRender.translationText
      : activeStepToRender.bubbleCaption;
    const fullText = rawFullText.replace(/\[.*?\]/g, "").trim();

    const textToSpeak = bubbleLanguage === "english" && activeStepToRender.translationText
      ? activeStepToRender.translationText
      : activeStepToRender.spokenDialogue;

    // Dynamic duration mapping to match actual / simulated speech time scaled by playbackSpeed
    const expectedDuration = Math.max(2000, Math.min(12000, textToSpeak.length * 60)) / playbackSpeed;
    const typingInterval = Math.max(5, Math.min(45, expectedDuration / fullText.length));

    let index = 0;
    const timer = setInterval(() => {
      index++;
      setTypedDialogue(fullText.slice(0, index));
      if (index >= fullText.length) {
        clearInterval(timer);
      }
    }, typingInterval);

    return () => clearInterval(timer);
  }, [activeStepToRender?.bubbleCaption, activeStepToRender?.translationText, bubbleLanguage, liveVoiceProfile, playbackSpeed]);

  if (!activeStep) {
    return (
      <div className="relative w-full h-[450px] bg-slate-900 rounded-3xl overflow-hidden border-4 border-slate-700 flex flex-col items-center justify-center text-center p-8 shadow-2xl">
        <div className="absolute inset-0 bg-radial-gradient from-indigo-900/30 to-slate-900 pointer-events-none" />
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="relative z-10"
        >
          <div className="relative w-28 h-28 bg-indigo-600/20 rounded-full flex items-center justify-center border-2 border-indigo-400 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
            <GraduationCap className="w-14 h-14 text-indigo-400" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-ping" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-teal-400 rounded-full animate-bounce" />
          </div>
        </motion.div>
        <h3 className="text-2xl font-bold text-slate-100 font-sans tracking-tight mb-2">Classroom Desk is Ready!</h3>
        <p className="text-slate-400 max-w-md text-sm font-sans leading-relaxed">
          Upload some files, text, or a YouTube URL on the left panel to kickstart your animated AI lesson.
        </p>
      </div>
    );
  }

  const activeStepToRenderOrFallback = activeStepToRender || activeStep;
  const fullTextForProgress = activeStepToRenderOrFallback
    ? (bubbleLanguage === "english" && activeStepToRenderOrFallback.translationText
        ? activeStepToRenderOrFallback.translationText
        : activeStepToRenderOrFallback.bubbleCaption)
    : "";
  const progressRatio = fullTextForProgress && typedDialogue
    ? typedDialogue.length / fullTextForProgress.length
    : 1.0;

  const getActiveGestureFromDialogue = (spokenDialogue: string, ratio: number, defaultGesture: string): string => {
    if (!spokenDialogue) return defaultGesture;

    const regex = /\[([^\]]+)\]/g;
    let match;
    const markers: { emotion: string; cleanedPos: number }[] = [];
    let cleanedLength = 0;
    let lastIndex = 0;

    while ((match = regex.exec(spokenDialogue)) !== null) {
      const markerText = match[0];
      const emotion = match[1].toLowerCase().trim();
      const matchIndex = match.index;
      
      cleanedLength += spokenDialogue.substring(lastIndex, matchIndex).length;
      markers.push({ emotion, cleanedPos: cleanedLength });
      lastIndex = matchIndex + markerText.length;
    }
    cleanedLength += spokenDialogue.substring(lastIndex).length;

    if (markers.length === 0) {
      return defaultGesture;
    }

    const currentCleanedPos = ratio * cleanedLength;
    let activeMarker = markers[0].emotion;
    for (const marker of markers) {
      if (currentCleanedPos >= marker.cleanedPos) {
        activeMarker = marker.emotion;
      } else {
        break;
      }
    }

    if (activeMarker.includes("excited") || activeMarker.includes("celebrat")) {
      return "thumbs_up";
    }
    if (activeMarker.includes("laugh") || activeMarker.includes("giggle") || activeMarker.includes("chuckle")) {
      return "celebrating";
    }
    if (activeMarker.includes("think") || activeMarker.includes("thoughtful") || activeMarker.includes("pause") || activeMarker.includes("wonder")) {
      return "thinking";
    }
    if (activeMarker.includes("warm") || activeMarker.includes("explaining") || activeMarker.includes("teach") || activeMarker.includes("friendly")) {
      return "explaining";
    }
    if (activeMarker.includes("whiteboard") || activeMarker.includes("look")) {
      return "pointing_whiteboard";
    }
    if (activeMarker.includes("point") || activeMarker.includes("highlight")) {
      return "pointing";
    }

    return defaultGesture;
  };

  const baseGesture = activeStepToRenderOrFallback?.teacherGesture || "idle";
  const rawTeacherGesture = activeStepToRenderOrFallback
    ? getActiveGestureFromDialogue(activeStepToRenderOrFallback.spokenDialogue, progressRatio, baseGesture)
    : "idle";

  const teacherGesture = isStaringBoard ? "thinking" : isErasingBoard ? "writing" : rawTeacherGesture;
  const whiteboardContent = activeStepToRenderOrFallback?.whiteboardContent || { heading: "", bulletPoints: [] };

  // Let's render custom CSS/SVG diagrams on the whiteboard based on selection or keyword inference!
  const getInferredDiagramType = (): string => {
    const type = whiteboardContent.diagramType;
    if (type && type !== "none") return type;

    // Detect keywords to dynamically load high-quality custom visuals if required
    const textContext = `${whiteboardContent.heading} ${whiteboardContent.bulletPoints.join(" ")}`.toLowerCase();
    
    if (textContext.includes("photosynthesis") || textContext.includes("plant") || textContext.includes("leaf") || textContext.includes("stomata") || textContext.includes("chloroplast") || textContext.includes("sunlight")) {
      return "sun_and_leaf";
    }
    if (textContext.includes("newton") || textContext.includes("force") || textContext.includes("math") || textContext.includes("graph") || textContext.includes("plot") || textContext.includes("acceleration") || textContext.includes("speed") || textContext.includes("velocity") || textContext.includes("formula") || textContext.includes("equation") || textContext.includes("laws of motion")) {
      return "graph_plot";
    }
    if (textContext.includes("pyramid") || textContext.includes("egypt") || textContext.includes("giza") || textContext.includes("tomb") || textContext.includes("ancient") || textContext.includes("pharaoh")) {
      return "pyramid_diagram";
    }
    if (textContext.includes("atom") || textContext.includes("molecule") || textContext.includes("chemistry") || textContext.includes("particle") || textContext.includes("electron") || textContext.includes("proton") || textContext.includes("neutron") || textContext.includes("nucleus")) {
      return "atom_model";
    }

    return "none";
  };

  const renderWhiteboardDiagram = () => {
    const type = getInferredDiagramType();
    const labels = whiteboardContent.diagramLabels || [];
    
    switch (type) {
      case "process_flow":
        return (
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {labels.map((label, idx) => (
              <React.Fragment key={idx}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: idx * 0.15 }}
                  className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-mono font-medium shadow-sm"
                >
                  {label}
                </motion.div>
                {idx < labels.length - 1 && (
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-emerald-500 text-lg font-bold"
                  >
                    →
                  </motion.span>
                )}
              </React.Fragment>
            ))}
          </div>
        );
      case "comparison_table":
        return (
          <div className="mt-4 border border-teal-500/30 rounded-lg overflow-hidden text-xs max-w-sm mx-auto">
            <div className="grid grid-cols-2 bg-teal-950/80 border-b border-teal-500/30 font-bold text-teal-300 p-2 text-center">
              <div>{labels[0] || "A"}</div>
              <div className="border-l border-teal-500/30">{labels[1] || "B"}</div>
            </div>
            <div className="grid grid-cols-2 p-2 bg-teal-950/20 text-teal-100/90 text-center">
              <div>{labels[2] || "Pros"}</div>
              <div className="border-l border-teal-500/30">{labels[3] || "Cons"}</div>
            </div>
          </div>
        );
      case "anatomy_chart":
        return (
          <div className="relative mt-4 w-40 h-28 bg-emerald-950/30 border border-emerald-500/30 rounded-lg mx-auto flex items-center justify-center">
            <div className="absolute w-16 h-16 rounded-full border-2 border-emerald-400 border-dashed animate-spin-slow flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/30" />
            </div>
            {labels.map((label, idx) => {
              const angles = [0, 120, 240];
              const angle = angles[idx % angles.length];
              const x = Math.cos((angle * Math.PI) / 180) * 55;
              const y = Math.sin((angle * Math.PI) / 180) * 35;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 0, y: 0 }}
                  animate={{ opacity: 1, x, y }}
                  className="absolute bg-emerald-900 border border-emerald-400 text-emerald-200 text-[10px] px-1.5 py-0.5 rounded shadow-md font-sans font-medium"
                >
                  {label}
                </motion.div>
              );
            })}
          </div>
        );
      case "timeline_chart":
        return (
          <div className="mt-5 relative px-4">
            <div className="h-1 bg-yellow-600/50 w-full rounded relative">
              <div className="absolute inset-y-0 left-0 bg-yellow-400 w-full rounded" />
            </div>
            <div className="flex justify-between items-start -mt-1.5">
              {labels.map((label, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-200 shadow" />
                  <span className="text-[10px] text-yellow-200 mt-1 font-sans text-center max-w-[80px] leading-tight">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      case "concept_map":
        return (
          <div className="relative mt-4 h-28 max-w-xs mx-auto">
            {labels[0] && (
              <div className="absolute left-1/2 -translate-x-1/2 top-1 bg-amber-950 border border-amber-400 text-amber-200 px-2 py-0.5 rounded text-[11px] font-bold">
                {labels[0]}
              </div>
            )}
            {labels.length > 1 && (
              <>
                <div className="absolute left-1/2 -translate-x-1/2 top-8 text-amber-500 text-xs">⬇</div>
                <div className="flex justify-around absolute inset-x-0 bottom-1">
                  {labels.slice(1, 4).map((label, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="bg-amber-900/60 border border-amber-500/50 text-amber-200 text-[10px] px-2 py-1 rounded shadow-sm max-w-[80px] text-center"
                    >
                      {label}
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      case "graph_plot":
        return (
          <div className="mt-3 relative w-40 h-28 bg-teal-950/20 border border-teal-500/20 rounded-lg mx-auto flex flex-col justify-between p-1.5 font-mono text-[9px] text-teal-300">
            <svg className="w-full h-full" viewBox="0 0 100 70">
              <line x1="10" y1="10" x2="90" y2="10" stroke="rgba(20,184,166,0.1)" strokeDasharray="2" />
              <line x1="10" y1="30" x2="90" y2="30" stroke="rgba(20,184,166,0.1)" strokeDasharray="2" />
              <line x1="10" y1="50" x2="90" y2="50" stroke="rgba(20,184,166,0.1)" strokeDasharray="2" />
              <line x1="30" y1="10" x2="30" y2="60" stroke="rgba(20,184,166,0.1)" strokeDasharray="2" />
              <line x1="50" y1="10" x2="50" y2="60" stroke="rgba(20,184,166,0.1)" strokeDasharray="2" />
              <line x1="70" y1="10" x2="70" y2="60" stroke="rgba(20,184,166,0.1)" strokeDasharray="2" />
              <line x1="10" y1="10" x2="10" y2="60" stroke="#14b8a6" strokeWidth="1" />
              <line x1="10" y1="60" x2="90" y2="60" stroke="#14b8a6" strokeWidth="1" />
              <motion.path
                d="M 10 55 Q 30 15, 50 40 T 90 20"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5 }}
              />
              <circle cx="30" cy="27" r="2" fill="#ef4444" />
              <circle cx="50" cy="40" r="2" fill="#ef4444" />
              <circle cx="70" cy="28" r="2" fill="#ef4444" />
              <text x="85" y="68" fill="#14b8a6" fontSize="6">X</text>
              <text x="3" y="15" fill="#14b8a6" fontSize="6">Y</text>
            </svg>
            <div className="text-[8px] text-center text-teal-400 font-sans -mt-1 font-bold">
              {labels[0] || "Function Plot (f(x))"}
            </div>
          </div>
        );
      case "sun_and_leaf":
        return (
          <div className="mt-3 relative w-40 h-28 bg-emerald-950/20 border border-emerald-500/20 rounded-lg mx-auto overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 70">
              <circle cx="15" cy="15" r="8" fill="#fbbf24" className="animate-pulse" />
              <line x1="15" y1="3" x2="15" y2="5" stroke="#fbbf24" strokeWidth="1" />
              <line x1="15" y1="25" x2="15" y2="27" stroke="#fbbf24" strokeWidth="1" />
              <line x1="3" y1="15" x2="5" y2="15" stroke="#fbbf24" strokeWidth="1" />
              <line x1="25" y1="15" x2="27" y2="15" stroke="#fbbf24" strokeWidth="1" />
              <path d="M 23 20 L 35 32" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2" />
              <text x="24" y="30" fill="#fbbf24" fontSize="5" fontWeight="bold">Light</text>
              <path d="M 40 45 C 50 30, 80 30, 85 45 C 80 60, 50 60, 40 45 Z" fill="#10b981" opacity="0.8" stroke="#34d399" strokeWidth="1" />
              <path d="M 40 45 Q 62 45 85 45" stroke="#047857" strokeWidth="1" />
              <path d="M 30 35 Q 45 35 52 41" fill="none" stroke="#60a5fa" strokeWidth="1" />
              <polygon points="52,41 48,39 52,37" fill="#60a5fa" transform="rotate(35, 52, 41)" />
              <text x="32" y="32" fill="#60a5fa" fontSize="5" fontWeight="black">CO₂</text>
              <path d="M 45 65 Q 48 55 52 48" fill="none" stroke="#3b82f6" strokeWidth="1" />
              <polygon points="52,48 49,52 47,49" fill="#3b82f6" />
              <text x="35" y="63" fill="#3b82f6" fontSize="5" fontWeight="black">H₂O</text>
              <path d="M 75 45 Q 85 40 92 35" fill="none" stroke="#f43f5e" strokeWidth="1" />
              <polygon points="92,35 88,36 90,39" fill="#f43f5e" />
              <text x="82" y="33" fill="#f43f5e" fontSize="5" fontWeight="black">O₂ + Sugar</text>
            </svg>
          </div>
        );
      case "pyramid_diagram":
        return (
          <div className="mt-3 relative w-40 h-28 bg-amber-950/20 border border-amber-500/20 rounded-lg mx-auto overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 70">
              <path d="M 0 60 Q 50 55 100 60 L 100 70 L 0 70 Z" fill="#78350f" opacity="0.6" />
              <circle cx="85" cy="18" r="6" fill="#f59e0b" />
              <polygon points="50,15 45,23 55,23" fill="#f59e0b" opacity="0.9" stroke="#d97706" strokeWidth="0.5" />
              <polygon points="45,23 40,33 60,33 55,23" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
              <polygon points="40,33 33,45 67,45 60,33" fill="#f59e0b" opacity="0.9" stroke="#d97706" strokeWidth="0.5" />
              <polygon points="33,45 25,60 75,60 67,45" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
              <polygon points="25,40 20,46 30,46" fill="#d97706" opacity="0.7" />
              <polygon points="20,46 15,58 35,58 30,46" fill="#b45309" opacity="0.7" />
              <text x="50" y="66" fill="#fef3c7" fontSize="5.5" textAnchor="middle" fontWeight="bold">
                {labels[0] || "Ancient Pyramid Complex"}
              </text>
            </svg>
          </div>
        );
      case "atom_model":
        return (
          <div className="mt-3 relative w-40 h-28 bg-purple-950/20 border border-purple-500/20 rounded-lg mx-auto overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 70">
              <ellipse cx="50" cy="35" rx="35" ry="10" fill="none" stroke="#a855f7" strokeWidth="0.75" transform="rotate(30, 50, 35)" strokeDasharray="1 1" />
              <ellipse cx="50" cy="35" rx="35" ry="10" fill="none" stroke="#a855f7" strokeWidth="0.75" transform="rotate(-30, 50, 35)" strokeDasharray="1 1" />
              <ellipse cx="50" cy="35" rx="35" ry="10" fill="none" stroke="#a855f7" strokeWidth="0.75" transform="rotate(90, 50, 35)" strokeDasharray="1 1" />
              <circle cx="50" cy="35" r="4" fill="#ef4444" />
              <circle cx="47" cy="33" r="3.5" fill="#3b82f6" />
              <circle cx="53" cy="32" r="3.5" fill="#ef4444" />
              <circle cx="51" cy="38" r="4" fill="#3b82f6" />
              <circle cx="46" cy="37" r="3.5" fill="#ef4444" />
              <motion.circle
                cx="50"
                cy="35"
                r="2"
                fill="#a855f7"
                animate={{
                  cx: [19, 50, 81, 50, 19],
                  cy: [18, 50, 52, 20, 18],
                }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
              />
              <motion.circle
                cx="50"
                cy="35"
                r="2"
                fill="#fbbf24"
                animate={{
                  cx: [19, 50, 81, 50, 19],
                  cy: [52, 20, 18, 50, 52],
                }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              />
              <text x="50" y="66" fill="#e9d5ff" fontSize="6.5" textAnchor="middle" fontWeight="bold">
                {labels[0] || "Bohr Atom Model"}
              </text>
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${isFullscreen ? "fixed inset-0 z-[9999] p-0 bg-slate-950 flex flex-col overflow-hidden" : "flex flex-col gap-4"}`}>
      {/* Upper bar with controls */}
      {!isFullscreen && (
        <div className="flex items-center justify-between bg-slate-800/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700/60 shadow-sm flex-wrap gap-2">

        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-400 animate-bounce" />
          <span className="text-xs text-slate-300 font-mono font-semibold tracking-wide">
            {interruptedDoubt ? (
              <span className="text-yellow-400 bg-yellow-400/10 px-2.5 py-0.5 rounded-full text-[11px] border border-yellow-400/20">
                ⚠️ Live Doubt Resolution Active
              </span>
            ) : (
              <span>
                STEP {currentStepIndex + 1} OF {totalSteps}: {activeStep.timestamp}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Raise Hand Button in standard controls bar */}
          <button
            onClick={toggleListening}
            disabled={isResolvingDoubt || isRateLimited}
            title={isListening ? "Listening... Click to cancel" : isWaitingForUserVoice ? "Waiting for teacher invitation... Click to cancel" : "Raise Hand / Ask a Doubt by speaking"}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border-2 transition-all hover:scale-[1.03] active:scale-[0.97] ${
              isListening
                ? "bg-red-500 border-red-600 text-white animate-pulse shadow-lg shadow-red-500/30"
                : isWaitingForUserVoice
                  ? "bg-indigo-600 border-indigo-700 text-white animate-pulse"
                  : "bg-amber-400 border-amber-500 text-slate-950 hover:bg-amber-300 hover:border-amber-400 animate-none"
            }`}
          >
            <Hand className={`w-3.5 h-3.5 ${isListening || isWaitingForUserVoice ? "animate-bounce" : ""}`} />
            <span>{isListening ? "Listening..." : isWaitingForUserVoice ? "Prompting..." : "Raise Hand"}</span>
          </button>

          {/* Gemini Live Voice Selection */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 shadow-inner">
            <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
              Voice:
            </span>
            <select
              value={liveVoiceProfile}
              onChange={(e) => {
                const newVoice = e.target.value;
                setLiveVoiceProfile(newVoice);
                onVoiceChange?.(newVoice);
              }}
              className="bg-transparent text-slate-200 text-[10px] font-bold outline-none cursor-pointer pr-1 border-none focus:ring-0"
              style={{ colorScheme: "dark" }}
            >
              <option value="Aoede">Aoede (Balanced & Warm)</option>
              <option value="Puck">Puck (Bright & Playful)</option>
              <option value="Charon">Charon (Deep & Calm)</option>
              <option value="Kore">Kore (Warm & Enthusiastic)</option>
              <option value="Fenrir">Fenrir (Energetic & Sharp)</option>
            </select>
          </div>

          <button
            onClick={() => setIsAudioOn(!isAudioOn)}
            className="p-1.5 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
            title={isAudioOn ? "Mute teacher voice effect" : "Unmute teacher voice effect"}
          >
            {isAudioOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
          </button>

          <button
            onClick={() => setIsBoardFocused(!isBoardFocused)}
            className={`p-1.5 rounded-lg transition-all ml-1 ${isBoardFocused ? "bg-indigo-600 text-white" : "bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white"}`}
            title={isBoardFocused ? "Unfocus Board" : "Focus Board"}
          >
            {isBoardFocused ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
          </button>
          <button
            onClick={() => toggleFullscreen()}
            className="p-1.5 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-all ml-1"
            title={isFullscreen ? "Exit Theater Mode" : "Enter Theater Mode"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400 animate-pulse" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      )}

      {/* Wrapper to support side-by-side Steps of Lecture Sidebar in fullscreen */}
      <div className={`flex-1 flex gap-0 overflow-hidden ${isFullscreen ? "flex-col" : "flex-col"}`}>
        {/* Classroom background stage */}
        <div className={`relative ${isFullscreen ? "flex-1 h-full min-h-[500px] rounded-none border-0" : "w-full flex-1 min-h-[460px] rounded-3xl border-4"} bg-sky-950/30 overflow-hidden border-slate-700 shadow-2xl flex items-stretch transition-all duration-300`}>
        
        {/* Sky View and windows */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 to-indigo-900 pointer-events-none" />
        
        {/* Stars/Dust particles floating in classroom light */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

        {/* Classroom Floor (perspective style) */}
        <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-amber-900 to-amber-800 border-t-8 border-amber-950 pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-28 bg-[radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.2),transparent_60%)] pointer-events-none" />

        
        {/* Kid-Friendly Cooldown Banner */}
        <AnimatePresence>
          {isRateLimited && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-400 text-slate-900 px-6 py-2 rounded-full font-bold shadow-xl border-4 border-amber-300 text-sm flex items-center gap-2"
            >
              🌟 <span>Your AI Teacher is taking a quick 60-second brain break! Resume lesson in {remainingSeconds}s...</span>
            </motion.div>
          )}
        </AnimatePresence>
{/* Blackboard frame */}
        <div className={`absolute transition-all duration-700 ease-in-out ${
          isBoardFocused 
            ? "inset-4 z-40 bg-slate-900 border-[8px] border-amber-950 rounded-xl shadow-2xl ring-4 ring-slate-800/80"
            : "left-8 right-44 top-6 bottom-32 bg-slate-900 border-[10px] border-amber-950 rounded-2xl shadow-2xl ring-4 ring-slate-800"
        } flex flex-col p-3 text-emerald-100 font-sans border-solid overflow-hidden`}>
          <div className="absolute top-0 right-0 p-1.5 opacity-20">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col h-full relative"
            >
              <div className="border-b border-dashed border-emerald-700 pb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold font-sans tracking-wide text-emerald-300 uppercase">
                  📋 {renderTextWithHoverableWords(whiteboardContent.heading, true)}
                </h4>
                {whiteboardContent.mathEquation && (
                  <span className="text-xs bg-emerald-950 border border-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded font-mono font-semibold">
                    {whiteboardContent.mathEquation}
                  </span>
                )}
              </div>

              <div className={`flex-1 overflow-hidden pr-1 py-3 text-left transition-all duration-700 ${isErasingBoard ? "blur-sm opacity-10 scale-[0.98]" : isStaringBoard ? "opacity-85 scale-100" : ""} flex gap-4 items-stretch`}>
                <div className={`${whiteboardContent.imageUrl ? "w-[58%]" : "w-full"} flex flex-col justify-between overflow-y-auto`}>
                  <motion.ul layout className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {whiteboardContent.bulletPoints.map((point, index) => (
                        <motion.li
                          layout
                          key={point + index}
                          initial={{ opacity: 0, x: -10, scale: 0.9 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                          transition={{ 
                            delay: index * 0.05, 
                            layout: { type: "spring", stiffness: 300, damping: 30 } 
                          }}
                          className="flex items-start gap-2 text-[12px] leading-relaxed text-emerald-100/90 origin-left"
                        >
                          <span className="text-yellow-400 font-bold mt-0.5">✦</span>
                          <span>{renderTextWithHoverableWords(point, true)}</span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>

                  {renderWhiteboardDiagram()}
                </div>

                {whiteboardContent.imageUrl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, rotate: 2 }}
                    animate={{ opacity: 1, scale: 1, rotate: -1 }}
                    className="w-[42%] bg-slate-950 border-4 border-slate-800 rounded-xl overflow-hidden shadow-2xl relative flex items-center justify-center self-center h-full max-h-[190px]"
                  >
                    <img
                      src={whiteboardContent.imageUrl + (whiteboardContent.imageUrl.includes('pollinations.ai') ? `&seed=${currentStepIndex}` : '')}
                      alt="Board Illustration"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    {/* Visual indicator / paper tape styling */}
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-yellow-100/90 backdrop-blur-sm text-[8px] font-black text-slate-800 px-2.5 py-0.5 rounded shadow-sm uppercase tracking-widest scale-90 select-none">
                      Illustration
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {isErasingBoard && (
            <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center z-20 pointer-events-none">
              {/* Moving blackboard eraser */}
              <motion.div
                animate={{
                  x: [-180, 180, -180, 180, 0],
                  y: [-60, -20, 20, 60, 0],
                  rotate: [0, 15, -15, 10, 0]
                }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
                className="w-16 h-8 bg-amber-800 border-2 border-amber-950 rounded-md shadow-xl flex flex-col justify-between p-1"
              >
                {/* Felt layers of the eraser */}
                <div className="h-1 bg-amber-900 rounded-sm" />
                <div className="h-1 bg-amber-950 rounded-sm" />
                <div className="h-1 bg-amber-900 rounded-sm" />
              </motion.div>
              {/* Wipe dust effect */}
              <motion.div
                animate={{ opacity: [0, 0.45, 0] }}
                transition={{ duration: 1.4 }}
                className="absolute inset-0 bg-emerald-100/10 backdrop-blur-[1px]"
              />
            </div>
          )}

          <div className="text-[9px] text-emerald-500 font-mono text-center border-t border-emerald-900/50 pt-1.5 flex justify-between items-center">
            <span>ClassroomLM Whiteboard v2.5</span>
            {isStaringBoard ? (
              <span className="text-yellow-400 animate-pulse font-bold">⚠️ Reading completed board...</span>
            ) : isErasingBoard ? (
              <span className="text-red-400 animate-bounce font-bold">🧹 Erasing board...</span>
            ) : (
              <span>📝 Chalk mode active</span>
            )}
          </div>
        </div>

        {/* Dynamic Speech Bubble */}
        <div className={`transition-opacity duration-700 ${isBoardFocused ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <AnimatePresence mode="wait">
            <motion.div
            key={activeStep.bubbleCaption + bubbleLanguage}
            initial={{ scale: 0.8, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 15 }}
            className={`absolute left-8 right-44 bottom-2 h-28 rounded-2xl p-3 shadow-2xl z-30 border-2 flex flex-col gap-1.5 overflow-hidden transition-all duration-300 ${
              isDarkMode ? "bg-slate-900/95 text-slate-100 border-indigo-950" : "bg-white/95 text-slate-800 border-indigo-100"
            }`}
          >
            {/* Pointer pointing right directly to the teacher stand */}
            <div className={`absolute -right-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[10px] transition-colors duration-300 ${
              isDarkMode ? "border-l-slate-900" : "border-l-white"
            }`} />
            <div className={`absolute -right-[13px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[11px] border-t-transparent border-b-[11px] border-b-transparent border-l-[11px] -z-10 transition-colors duration-300 ${
              isDarkMode ? "border-l-indigo-950" : "border-l-indigo-100"
            }`} />

            <div className={`flex items-center justify-between gap-2 border-b pb-1 mb-1 shrink-0 ${
              isDarkMode ? "border-slate-800" : "border-indigo-50"
            }`}>
              <div className={`flex items-center gap-1.5 text-[9px] font-extrabold uppercase font-mono tracking-widest ${
                isDarkMode ? "text-indigo-400" : "text-indigo-600"
              }`}>
                <span>{interruptedDoubt ? "AI Teacher (Replying to Doubt)" : "AI Teacher Dialogue"}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              </div>

              {/* Gemini Live voice active waveform mimicry */}
              {isSpeaking ? (
                <div className={`flex items-center gap-1.5 border rounded-full px-2 py-0.5 transition-colors duration-300 ${
                  isDarkMode ? "bg-indigo-950/40 border-indigo-900/50" : "bg-indigo-50 border-indigo-100"
                }`} title="Gemini Live Voice Active">
                  <div className="flex gap-0.5 items-center h-3 w-5">
                    <span className="w-0.5 h-1 bg-gradient-to-t from-indigo-500 to-purple-500 rounded animate-bounce" style={{ animationDuration: "0.6s" }} />
                    <span className="w-0.5 h-3 bg-gradient-to-t from-purple-500 to-pink-500 rounded animate-bounce" style={{ animationDuration: "0.4s", animationDelay: "0.1s" }} />
                    <span className="w-0.5 h-2 bg-gradient-to-t from-pink-500 to-orange-500 rounded animate-bounce" style={{ animationDuration: "0.7s", animationDelay: "0.2s" }} />
                    <span className="w-0.5 h-2.5 bg-gradient-to-t from-orange-500 to-indigo-500 rounded animate-bounce" style={{ animationDuration: "0.5s", animationDelay: "0.3s" }} />
                  </div>
                  <span className="text-[8px] font-black bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent font-sans tracking-widest uppercase">
                    GEMINI LIVE: {liveVoiceProfile}
                  </span>
                </div>
              ) : (
                <span className="text-[8px] font-semibold text-slate-400 font-mono">PAUSED</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <p className={`text-[12px] font-semibold leading-relaxed font-sans transition-colors ${
                isDarkMode ? "text-slate-200" : "text-slate-700"
              }`}>
                {bubbleLanguage === "english" && activeStep.translationText
                  ? renderTextWithHoverableWords(activeStep.translationText, false)
                  : renderTextWithHoverableWords(typedDialogue, false)}
              </p>

              {bubbleLanguage === "native" && activeStep.translationText && (
                <div className={`text-[10px] italic font-sans pt-1 mt-1 flex items-center justify-between border-t ${
                  isDarkMode ? "border-slate-800 text-slate-500" : "border-slate-100 text-slate-400"
                }`}>
                  <span>Eng: {renderTextWithHoverableWords(activeStep.translationText, false)}</span>
                </div>
              )}
            </div>
          </motion.div>
          </AnimatePresence>
        </div>

        {/* AI Teacher Avatar Standing on Right side */}
        <div className={`absolute right-6 bottom-4 w-36 h-80 z-20 flex flex-col items-center justify-end transition-opacity duration-700 ${isBoardFocused ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          
          {/* Avatar SVG wrapper */}
          <motion.svg
            viewBox="0 0 160 300"
            className="w-full h-full"
            animate={
              isSpeaking
                ? { y: [0, -1, 0] }
                : { y: [0, -0.3, 0] }
            }
            transition={{
              repeat: Infinity,
              duration: isSpeaking ? 2.0 : 4.0,
              ease: "easeInOut",
            }}
          >
            {/* SVG Shadows */}
            <ellipse cx="80" cy="285" rx="45" ry="10" fill="rgba(0,0,0,0.25)" />

            {/* LAYER 1: Back Hair / Collar Shadow (Animated with Head) */}
            <motion.g
              id="back-hair"
              animate={
                teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing"
                  ? { rotate: -12, x: -3 }
                  : isSpeaking
                  ? { rotate: [-1, 1, -1], y: [0, -0.5, 0] }
                  : { rotate: [0, 1, -1, 0] }
              }
              transition={{
                repeat: Infinity,
                duration: isSpeaking ? 1.8 : 5.0,
                ease: "easeInOut"
              }}
              style={{ transformOrigin: "80px 70px" }}
            >
              {avatarHairStyle === "normal" && gender === "female" && (
                <path d="M 40 48 C 35 5, 125 5, 120 48 L 126 130 C 126 150, 34 150, 34 130 Z" fill={avatarHairColor} />
              )}
            </motion.g>

            {/* LAYER 2: Body & Outfit */}
            <g id="body-and-clothes">
              {/* Left Leg */}
              <rect x="62" y="210" width="14" height="75" rx="6" fill="#2e2723" />
              {/* Right Leg */}
              <rect x="84" y="210" width="14" height="75" rx="6" fill="#2e2723" />
              {/* Shoes */}
              <ellipse cx="69" cy="285" rx="10" ry="6" fill="#1e1b18" />
              <ellipse cx="91" cy="285" rx="10" ry="6" fill="#1e1b18" />

              {/* Neck */}
              <rect x="72" y="70" width="16" height="38" fill={avatarSkinColor} />
              
              {/* Torso/Blazer Outfit */}
              <rect x={gender === "male" ? "42" : "45"} y="105" width={gender === "male" ? "76" : "70"} height="110" rx="20" fill={avatarOutfitColor} />
              <path d={gender === "male" ? "M 42 105 L 80 155 L 118 105 Z" : "M 45 105 L 80 155 L 115 105 Z"} fill="#e2e8f0" />
              {gender === "male" ? (
                <path d="M 76 125 L 84 125 L 80 165 Z" fill="#b91c1c" />
              ) : (
                <path d="M 76 125 L 84 125 L 80 165 Z" fill="#ef4444" />
              )}

              {/* Left Arm / Pointer Stick / Left Hand */}
              {teacherGesture === "pointing_whiteboard" ? (
                <motion.g
                  animate={{ rotate: [-2, 2, -2] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  style={{ transformOrigin: "45px 125px" }}
                >
                  <path d="M 45 125 L 10 95" stroke={avatarOutfitColor} strokeWidth="14" strokeLinecap="round" />
                  <circle cx="10" cy="95" r="6" fill={avatarSkinColor} />
                  <path d="M 10 95 L -45 53" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" />
                  <circle cx="-45" cy="53" r="4" fill="#ef4444" />
                </motion.g>
              ) : teacherGesture === "celebrating" ? (
                <g>
                  <motion.path
                    d="M 45 125 C 20 110, 15 60, 25 45"
                    stroke={avatarOutfitColor} strokeWidth="14" strokeLinecap="round" fill="none"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 0.4 }}
                  />
                  <motion.circle
                    cx="25" cy="45" r="6" fill={avatarSkinColor}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 0.4 }}
                  />
                </g>
              ) : (
                <g>
                  <path d="M 45 125 C 35 140, 32 170, 36 190" stroke={avatarOutfitColor} strokeWidth="14" strokeLinecap="round" fill="none" />
                  <circle cx="36" cy="190" r="6" fill={avatarSkinColor} />
                </g>
              )}

              {/* Right Arm / Right Hand */}
              {teacherGesture === "thinking" ? (
                <motion.g
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                  <path d="M 115 125 L 90 95" stroke={avatarOutfitColor} strokeWidth="14" strokeLinecap="round" />
                  <circle cx="90" cy="95" r="6" fill={avatarSkinColor} />
                  {/* hand on chin */}
                  <path d="M 90 95 L 85 95" stroke={avatarSkinColor} strokeWidth="4" strokeLinecap="round" />
                </motion.g>
              ) : teacherGesture === "pointing" ? (
                <motion.g
                  animate={{ scale: [1, 1.05, 1], x: [0, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                  <path d="M 115 125 C 120 110, 100 90, 85 90" stroke={avatarOutfitColor} strokeWidth="14" strokeLinecap="round" fill="none" />
                  <circle cx="85" cy="90" r="6" fill={avatarSkinColor} />
                  {/* Pointing finger */}
                  <path d="M 85 90 L 75 90" stroke={avatarSkinColor} strokeWidth="4" strokeLinecap="round" />
                </motion.g>
              ) : teacherGesture === "writing" ? (
                <motion.g
                  animate={{ x: [0, -4, 0], y: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut" }}
                >
                  <path d="M 115 125 L 75 110" stroke={avatarOutfitColor} strokeWidth="14" strokeLinecap="round" />
                  <circle cx="75" cy="110" r="6" fill={avatarSkinColor} />
                </motion.g>
              ) : teacherGesture === "celebrating" ? (
                <g>
                  <motion.path
                    d="M 115 125 C 140 110, 145 60, 135 45"
                    stroke={avatarOutfitColor} strokeWidth="14" strokeLinecap="round" fill="none"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 0.4, delay: 0.2 }}
                  />
                  <motion.circle
                    cx="135" cy="45" r="6" fill={avatarSkinColor}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 0.4, delay: 0.2 }}
                  />
                </g>
              ) : (
                <g>
                  <path d="M 115 125 C 125 140, 128 170, 124 190" stroke={avatarOutfitColor} strokeWidth="14" strokeLinecap="round" fill="none" />
                  <circle cx="124" cy="190" r="6" fill={avatarSkinColor} />
                </g>
              )}
              
              {/* Smart Teacher Badge */}
              <circle cx="100" cy="125" r="4" fill="#fbbf24" />
            </g>

            {/* Neck & Head animated group */}
            <motion.g
              animate={
                teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing"
                  ? { rotate: -12, x: -3 }
                  : isSpeaking
                  ? { rotate: [-1, 1, -1], y: [0, -0.5, 0] }
                  : { rotate: [0, 1, -1, 0] }
              }
              transition={{
                repeat: Infinity,
                duration: isSpeaking ? 1.8 : 5.0,
                ease: "easeInOut"
              }}
              style={{ transformOrigin: "80px 70px" }}
            >
              {/* LAYER 3: Main Head Base */}
              <g id="head-base">
                <circle cx="80" cy="50" r="28" fill={avatarSkinColor} />
              </g>

              {/* LAYER 4: Facial Features */}
              <g id="eyes-and-brows">
                {/* Blushing cheeks */}
                <circle cx={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" ? "56" : "60"} cy="54" r="3" fill="#fca5a5" opacity="0.6" />
                <circle cx={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" ? "96" : "100"} cy="54" r="3" fill="#fca5a5" opacity="0.6" />

                {/* Eyes */}
                <motion.circle 
                  cx={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" ? "65" : "70"} cy="48" r="2.5" fill="#1e1b18"
                  animate={{ scaleY: [1, 1, 0, 1, 1, 1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 4, times: [0, 0.45, 0.46, 0.48, 0.95, 0.96, 0.97, 1] }}
                  style={{ transformOrigin: "70px 48px" }}
                />
                <motion.circle 
                  cx={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" ? "85" : "90"} cy="48" r="2.5" fill="#1e1b18"
                  animate={{ scaleY: [1, 1, 0, 1, 1, 1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 4, times: [0, 0.45, 0.46, 0.48, 0.95, 0.96, 0.97, 1] }}
                  style={{ transformOrigin: "90px 48px" }}
                />
              </g>

              {/* LAYER 5: Dynamic Mouth */}
              <g id="mouth">
                {isSpeaking ? (
                  <g className="mouth-speaking" style={{ transformOrigin: teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" ? "75px 65px" : "80px 65px" }}>
                    <path
                      d={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" 
                        ? "M 69 65 Q 75 76 81 65 Z" 
                        : "M 74 65 Q 80 76 86 65 Z"}
                      fill="#4A0E17"
                    />
                    <path 
                      d={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" 
                        ? "M 71 65 L 79 65 L 77 68 L 73 68 Z" 
                        : "M 76 65 L 84 65 L 82 68 L 78 68 Z"}
                      fill="#ffffff" 
                      opacity="0.9"
                    />
                  </g>
                ) : (
                  <path 
                    d={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" 
                      ? "M 69 66 Q 75 72 81 66" 
                      : "M 74 66 Q 80 72 86 66"}
                    stroke="#5C2C16" 
                    strokeWidth="2.5" 
                    fill="none" 
                    strokeLinecap="round" 
                  />
                )}
              </g>

              {/* LAYER 6: Front Hair & Accessories */}
              <g id="front-hair">
                {avatarHairStyle === "normal" && (
                  <g>
                    {gender === "female" ? (
                      <path d="M 44 35 C 44 -10, 116 -10, 116 35 L 120 75 Q 110 50, 80 25 Q 50 50, 40 75 Z" fill={avatarHairColor} opacity="0.95" />
                    ) : (
                      <>
                        <path d="M 50 42 C 50 18, 110 18, 110 42 C 110 32, 50 32, 50 42 Z" fill={avatarHairColor} />
                        <path d="M 48 38 Q 70 24 85 32 Q 100 24 112 38 L 112 44 Q 80 34 48 44 Z" fill={avatarHairColor} opacity="0.9" />
                      </>
                    )}
                  </g>
                )}
                {avatarHairStyle === "smart" && (
                  <g>
                    <path d="M 50 42 C 50 20, 110 20, 110 42 C 110 25, 50 25, 50 42 Z" fill={avatarHairColor} />
                    <path d="M 52 40 Q 64 30 80 38 Q 96 30 108 40 L 108 52 Q 112 36 102 32 Q 80 25 58 32 Z" fill={avatarHairColor} opacity="0.85" />
                  </g>
                )}
                {avatarHairStyle === "bun" && (
                  <g>
                    <circle cx="80" cy="18" r="12" fill={avatarHairColor} />
                    <path d="M 50 42 C 50 20, 110 20, 110 42 C 110 25, 50 25, 50 42 Z" fill={avatarHairColor} />
                    <path d="M 52 40 Q 80 30 108 40 L 108 46 Q 80 36 52 46 Z" fill={avatarHairColor} opacity="0.8" />
                  </g>
                )}
                {avatarHairStyle === "spiky" && (
                  <g>
                    <path d="M 52 38 L 56 18 L 64 30 L 72 13 L 80 30 L 88 13 L 96 30 L 108 38" stroke={avatarHairColor} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <path d="M 50 42 C 50 24, 110 24, 110 42 C 110 28, 50 28, 50 42 Z" fill={avatarHairColor} />
                  </g>
                )}
                {avatarHairStyle === "professor" && (
                  <g>
                    <circle cx="48" cy="46" r="10" fill={avatarHairColor} />
                    <circle cx="112" cy="46" r="10" fill={avatarHairColor} />
                    <path d="M 52 46 Q 80 25 108 46" stroke={avatarHairColor} strokeWidth="5" fill="none" />
                  </g>
                )}
                
                {/* Face details: Glasses */}
                {avatarGlassesColor !== "none" && (
                  <g>
                    <rect x={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" ? "57" : "62"} y="42" width="16" height="12" rx="2" fill="none" stroke={avatarGlassesColor} strokeWidth="2.5" />
                    <rect x={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" ? "77" : "82"} y="42" width="16" height="12" rx="2" fill="none" stroke={avatarGlassesColor} strokeWidth="2.5" />
                    <line x1={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" ? "73" : "78"} y1="48" x2={teacherGesture === "pointing_whiteboard" || teacherGesture === "writing" || teacherGesture === "thinking" || teacherGesture === "pointing" || teacherGesture === "thinking" || teacherGesture === "pointing" ? "77" : "82"} y2="48" stroke={avatarGlassesColor} strokeWidth="2" />
                    <circle cx="108" cy="48" r="2" fill={avatarGlassesColor} />
                    <circle cx="52" cy="48" r="2" fill={avatarGlassesColor} />
                  </g>
                )}
              </g>
            </motion.g>
          </motion.svg>

          {/* Sparkles / Confetti overlay for celebrating gesture */}
          {teacherGesture === "celebrating" && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: [1, 1.3, 0.8], opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="absolute text-yellow-300 top-10 left-10"
              >
                ✦
              </motion.div>
              <motion.div
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: [1, 1.4, 0.7], opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 1.0, delay: 0.2 }}
                className="absolute text-teal-300 top-4 right-8"
              >
                ✦
              </motion.div>
              <motion.div
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: [1, 1.2, 0.6], opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 0.7, delay: 0.4 }}
                className="absolute text-pink-300 bottom-16 right-12"
              >
                ✦
              </motion.div>
            </div>
          )}
        </div>

        {/* Small floating hint elements for fun detail */}
        <div className="absolute left-6 bottom-4 flex items-center gap-2 text-xs bg-slate-800/90 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl font-mono shadow">
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span>Active Desk: ClassroomLM</span>
        </div>

        <div className="absolute right-4 top-4 flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-[11px] font-bold font-sans">
          <Sparkles className="w-3 h-3 animate-spin" />
          <span>Gemini 3.5 AI Classroom</span>
        </div>

        {/* Real-time Raise Hand / Voice Doubt Interruption Overlay on Top of the Classroom View */}
        <AnimatePresence>
          {(isListening || isWaitingForUserVoice) && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 border-2 border-amber-400 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 max-w-md w-[92%] mx-auto z-50 text-slate-100 backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                    <Hand className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                    Hand Raised: Ask AI Doubt
                  </span>
                </div>
                <button
                  onClick={toggleListening}
                  className="text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded-md hover:bg-slate-700 transition-all"
                >
                  Close
                </button>
              </div>

              <div className="text-left py-1">
                <p className="text-[9px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">
                  {isWaitingForUserVoice ? "⏳ Waiting for teacher invitation..." : "🔴 Voice Dictation (Speak your doubt):"}
                </p>
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl mt-1.5 min-h-[50px] text-[12px] font-medium text-slate-200 leading-relaxed shadow-inner">
                  {doubtText ? (
                    <span className="text-amber-100">"{doubtText}"</span>
                  ) : isWaitingForUserVoice ? (
                    <span className="text-indigo-300 italic animate-pulse">"The teacher is pausing the class to invite your doubt. Microphone will open automatically in a second..."</span>
                  ) : (
                    <span className="text-slate-500 italic">"The classroom microphone is live! Please ask your teacher a question out loud..."</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 text-[11px] font-bold font-sans">
                <button
                  onClick={toggleListening}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                >
                  {isWaitingForUserVoice ? "Cancel" : "Done Speaking"}
                </button>
                <button
                  onClick={() => {
                    if (submitDoubt) submitDoubt();
                  }}
                  disabled={isResolvingDoubt || !doubtText.trim() || isWaitingForUserVoice}
                  className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:hover:bg-amber-400 text-slate-950 rounded-lg transition-all flex items-center gap-1.5 shadow"
                >
                  {isResolvingDoubt ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Answering...</span>
                    </>
                  ) : (
                    <>
                      <span>Ask AI Teacher</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Fullscreen Controls */}
      {isFullscreen && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-slate-700 shadow-2xl z-[10000]">
          <button
            onClick={onPauseToggle}
            className={`flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
              isPlaying
                ? "bg-red-500 hover:bg-red-600 shadow-red-500/10"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 animate-pulse"
            }`}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          
          <button
            onClick={toggleListening}
            disabled={isResolvingDoubt || isRateLimited}
            title={isListening ? "Listening... Click to cancel" : isWaitingForUserVoice ? "Waiting for teacher invitation... Click to cancel" : "Raise Hand / Ask a Doubt by speaking"}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border-2 transition-all hover:scale-105 active:scale-95 ${
              isListening
                ? "bg-red-500 border-red-600 text-white animate-pulse shadow-lg shadow-red-500/30"
                : isWaitingForUserVoice
                  ? "bg-indigo-600 border-indigo-700 text-white animate-pulse"
                  : "bg-amber-400 border-amber-500 text-slate-950 hover:bg-amber-300 hover:border-amber-400"
            }`}
          >
            <Hand className={`w-4 h-4 ${isListening || isWaitingForUserVoice ? "animate-bounce" : ""}`} />
            <span>{isListening ? "Listening..." : isWaitingForUserVoice ? "Prompting..." : "Raise Hand"}</span>
          </button>

          <button
            onClick={() => toggleFullscreen()}
            className="p-2 rounded-xl bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
            title="Exit Theater Mode"
          >
            <Minimize2 className="w-5 h-5 text-amber-400" />
          </button>
        </div>
      )}
    </div>
    {/* Control bar for timeline navigation */}
      {!interruptedDoubt ? (
        <div className="flex items-center justify-between gap-4 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
          <button
            onClick={onPauseToggle}
            className={`flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
              isPlaying
                ? "bg-red-500 hover:bg-red-600 shadow-red-500/10"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10"
            }`}
          >
            {isPlaying ? "⏸ Pause Lesson" : "▶ Resume Lesson"}
          </button>

          {/* Playback speed slider control */}
          <div className="flex items-center gap-2 bg-slate-700/30 px-3 py-1.5 rounded-xl border border-slate-700/40">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider whitespace-nowrap">
              Speed: {playbackSpeed.toFixed(1)}x
            </span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              id="playback-speed-slider"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="w-20 accent-indigo-500 cursor-pointer h-1.5 rounded-lg bg-slate-800"
              title="Adjust teacher speaking playback speed"
            />
          </div>

          {/* Stepper buttons */}
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => onStepChange(idx)}
                className={`w-8 h-8 rounded-lg font-mono text-xs font-bold transition-all ${
                  idx === currentStepIndex
                    ? "bg-indigo-600 text-white shadow-md scale-105"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
                }`}
                title={`Go to slide ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 bg-yellow-500/10 p-3 rounded-2xl border border-yellow-500/30">
          <p className="text-xs text-yellow-400 font-sans font-medium">
            💡 <strong>AI Teacher is answering:</strong> "{interruptedDoubt.dialogue.slice(0, 50)}..."
          </p>
          <button
            onClick={onResolveInterruption}
            className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md"
          >
            Back to Main Lesson ➔
          </button>
        </div>
      )}

      {/* Absolute floating Word Definition Tooltip */}
      <AnimatePresence>
        {hoveredWord && hoveredWord.rect && containerRef.current && (
          (() => {
            const containerRect = containerRef.current.getBoundingClientRect();
            const top = hoveredWord.rect.top - containerRect.top;
            const left = hoveredWord.rect.left - containerRect.left + (hoveredWord.rect.width / 2);
            
            const cacheEntry = definitionsCache[hoveredWord.word];
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute",
                  top: `${top - 6}px`,
                  left: `${left}px`,
                  transform: "translate(-50%, -100%)",
                  zIndex: 99999,
                }}
                className="w-64 bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 shadow-2xl rounded-2xl p-3.5 pointer-events-none select-none text-left"
              >
                <div className="flex items-start justify-between border-b border-slate-800/80 pb-1.5 mb-2">
                  <div>
                    <h5 className="text-[13px] font-black tracking-tight text-white capitalize">
                      {hoveredWord.word}
                    </h5>
                    {cacheEntry && cacheEntry.phonetic && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {cacheEntry.phonetic}
                      </span>
                    )}
                  </div>
                  {cacheEntry && cacheEntry.partOfSpeech && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-indigo-500/25 text-indigo-300 border border-indigo-500/30">
                      {cacheEntry.partOfSpeech}
                    </span>
                  )}
                </div>

                {cacheEntry?.loading ? (
                  <div className="flex items-center gap-2 py-2 text-[11px] text-slate-400 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    <span>Defining word...</span>
                  </div>
                ) : cacheEntry?.error ? (
                  <p className="text-[11px] text-amber-300/90 leading-relaxed font-sans font-medium">
                    {cacheEntry.definition}
                  </p>
                ) : cacheEntry ? (
                  <p className="text-[11px] text-slate-200 leading-relaxed font-sans font-medium">
                    {cacheEntry.definition}
                  </p>
                ) : (
                  <div className="flex items-center gap-2 py-2 text-[11px] text-slate-400 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    <span>Loading...</span>
                  </div>
                )}

                <div className="mt-2.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                  <span>📖 Dictionary API</span>
                  <span>Hover to define</span>
                </div>

                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-t-[6px] border-t-slate-900 border-x-[6px] border-x-transparent" />
              </motion.div>
            );
          })()
        )}
      </AnimatePresence>
    </div>
  );
}
