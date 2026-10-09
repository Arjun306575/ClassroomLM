
const audioQueue: { text: string; language: string; onStart: () => void; onEnd: () => void }[] = [];
let isPlayingQueue = false;

function processAudioQueue() {
  if (audioQueue.length === 0) {
    isPlayingQueue = false;
    return;
  }
  isPlayingQueue = true;
  const { text, language, onStart, onEnd } = audioQueue.shift();
  
  window.speechSynthesis.cancel();
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

import React, { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";
import { Lesson, TimelineStep, QuizQuestion } from "./types";
import HelpOverlay from "./components/HelpOverlay";
import { jsPDF } from "jspdf";
import ClassroomScene from "./components/ClassroomScene";
import { GeminiLiveWave } from "./components/GeminiLiveWave";
import ImageAnnotator from "./components/ImageAnnotator";
import IntroAnimation from "./components/IntroAnimation";
import PolicyModal, { PolicyPageType } from "./components/PolicyModal";
import AppBackground from "./components/AppBackground";
import StudyPathMap from "./components/StudyPathMap";
import MagicCameraOverlay from "./components/MagicCameraOverlay";
import LessonLoadingScreen from "./components/LessonLoadingScreen";
import confetti from "canvas-confetti";
import { useClassroomRateLimit } from "./hooks/useClassroomRateLimit";
import {
  Upload,
  Activity,
  Link,
  BookOpen,
  GraduationCap,
  Sparkles,
  HelpCircle,
  FileText,
  Video,
  Award,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  Star,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  AlertCircle,
  Mic,
  MicOff,
  Hand,
  Sun,
  Moon,
  Play,
  Maximize,
  Menu,
  Library,
  Globe,
  Headphones,
  Flame,
  X,
  MessageCircle,
  Paperclip,
  Image as ImageIcon,
  FileUp,
  Trash2,
  Copy,
  Check,
  Palette,
  Wand2,
  Volume2,
  VolumeX,
  StopCircle,
  Download,
  Share2,
  Camera,
  Map
} from "lucide-react";

const ENTHUSIASTIC_PROMPT_BY_LANG: Record<string, string> = {
  "English": "Ah, a question! Wonderful! Go ahead, tell me what you're thinking! I'm listening!",
  "Hindi": "अरे, एक सवाल! बहुत बढ़िया! ज़रूर पूछिए, मैं सुन रही हूँ!",
  "Telugu": "అవునా, ఒక సందేహం! చాలా సంతోషం! అడగండి, నేను వింటున్నాను!",
  "Spanish": "¡Oh, una pregunta! ¡Estupendo! ¡Adelante, dime qué tienes en mente! ¡Te escucho!",
  "French": "Oh, une question ! Merveilleux ! Allez-y, dites-moi tout, je vous écoute !",
  "German": "Ah, eine Frage! Wunderbar! Schieß los, erzähl mir, was dich beschäftigt! Ich höre zu!",
  "Japanese": "おや、質問ですね！素晴らしい！どうぞ、気になっていることを教えてください。聞いていますよ！"
};

const CHAT_THEMES = {
  Default: {
    headerBg: "bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600",
    windowBorder: {
      dark: "border-indigo-600/80 text-white",
      light: "border-indigo-200 text-slate-800"
    },
    userBubble: "bg-indigo-600 text-white rounded-br-none hover:bg-indigo-500",
    tutorBubble: {
      dark: "bg-slate-850 border border-slate-750 text-slate-100 rounded-bl-none",
      light: "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
    },
    activeBtn: "bg-indigo-600 border-indigo-600 text-white shadow-sm scale-105",
    iconColor: "text-indigo-500",
  },
  Ocean: {
    headerBg: "bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600",
    windowBorder: {
      dark: "border-sky-600/80 text-white",
      light: "border-sky-200 text-slate-800"
    },
    userBubble: "bg-sky-600 text-white rounded-br-none hover:bg-sky-500",
    tutorBubble: {
      dark: "bg-cyan-950/40 border border-cyan-850 text-cyan-100 rounded-bl-none",
      light: "bg-cyan-50 border border-cyan-100 text-cyan-900 rounded-bl-none"
    },
    activeBtn: "bg-sky-600 border-sky-600 text-white shadow-sm scale-105",
    iconColor: "text-sky-500",
  },
  Forest: {
    headerBg: "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600",
    windowBorder: {
      dark: "border-emerald-600/80 text-white",
      light: "border-emerald-200 text-slate-800"
    },
    userBubble: "bg-emerald-700 text-white rounded-br-none hover:bg-emerald-600",
    tutorBubble: {
      dark: "bg-green-950/40 border border-green-850 text-green-100 rounded-bl-none",
      light: "bg-green-50/70 border border-green-100 text-green-900 rounded-bl-none"
    },
    activeBtn: "bg-emerald-600 border-emerald-600 text-white shadow-sm scale-105",
    iconColor: "text-emerald-500",
  },
  Sunset: {
    headerBg: "bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500",
    windowBorder: {
      dark: "border-orange-600/80 text-white",
      light: "border-orange-200 text-slate-800"
    },
    userBubble: "bg-orange-600 text-white rounded-br-none hover:bg-orange-500",
    tutorBubble: {
      dark: "bg-amber-950/30 border border-amber-850 text-amber-100 rounded-bl-none",
      light: "bg-amber-50 border border-amber-100 text-amber-900 rounded-bl-none"
    },
    activeBtn: "bg-orange-650 border-orange-650 text-white shadow-sm scale-105",
    iconColor: "text-orange-500",
  }
};

const renderBoldText = (text: string) => {
  return text.split("**").map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} className="font-extrabold text-indigo-500 dark:text-indigo-400">{part}</strong>;
    }
    return part.split("*").map((subpart, subindex) => {
      if (subindex % 2 === 1) {
        return <em key={subindex} className="italic text-amber-500 dark:text-amber-400 font-semibold">{subpart}</em>;
      }
      return subpart;
    });
  });
};


function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn("Error reading localStorage", error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn("Error setting localStorage", error);
    }
  };

  return [storedValue, setValue] as const;
}

async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      attempt++;
      console.warn(`429 Rate Limit encountered. Waiting 5 seconds before retry ${attempt}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
    return response;
  }
  return fetch(url, options);
}

export default function App() {
  const { requestCount, remainingSeconds, isLocked: isRateLimited, trackRequest } = useClassroomRateLimit();

  const [appStage, setAppStage] = useLocalStorage<"app" | "path">("appStage_v2", "app");
  const [activePolicyPage, setActivePolicyPage] = useState<PolicyPageType>(null);
  // Light / Dark mode state
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!localStorage.getItem("guest_id")) {
        localStorage.setItem("guest_id", "guest_" + Math.random().toString(36).substring(2, 9));
      }
    }
  }, []);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

  const [showIntro, setShowIntro] = useState(() => {
    return typeof window !== "undefined" && !sessionStorage.getItem("hasSeenIntro");
  });

  const handleIntroComplete = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("hasSeenIntro", "true");
    }
    setShowIntro(false);
  };


  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
    if (mediaQuery.matches) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);


  // Target preferences
  const [gradeLevel, setGradeLevel] = useState("7th Grade");
  const [language, setLanguage] = useState("English");
  const [optionsTab, setOptionsTab] = useState<"tutor" | "homework">("tutor");
  
  // Lesson/Tutor inputs
  const [customTopic, setCustomTopic] = useLocalStorage("customTopic", "");
  const [pastedText, setPastedText] = useLocalStorage("pastedText", "");
  
  // Homework assist inputs
  const [homeworkText, setHomeworkText] = useLocalStorage("homeworkText", "");
  const [homeworkFile, setHomeworkFile] = useState<{ name: string; base64: string; type: string } | null>(null);
  const [homeworkAudioFile, setHomeworkAudioFile] = useState<{ name: string; base64: string; type: string } | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useLocalStorage("youtubeUrl", "");
  const [websiteUrl, setWebsiteUrl] = useLocalStorage("websiteUrl", "");
  const [audioFile, setAudioFile] = useState<{
    name: string;
    content: string;
    type: string;
  } | null>(null);
  
  const [savedLectures, setSavedLectures] = useState<{
    id: string;
    title: string;
    lesson: Lesson;
    timestamp: number;
    inputs: {
      customTopic: string;
      pastedText: string;
      youtubeUrl: string;
      websiteUrl: string;
      audioFile: { name: string; content: string; type: string } | null;
      language: string;
    }
  }[]>([]);

  // File Upload state
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    type: string;
    base64: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Lesson generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [lesson, setLesson] = useLocalStorage<Lesson | null>("activeLesson_v2", null);

  // Classroom playback controller
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(7000); // ms per step

  // Session Progress State
  const [doubtsResolved, setDoubtsResolved] = useState(0);
  const [activeLearningTime, setActiveLearningTime] = useState(0);


  useEffect(() => {
    let interval;
    if (appStage === "app") {
      interval = setInterval(() => {
        if (!document.hidden) {
          setActiveLearningTime((prev) => prev + 1);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [appStage]);

  // Interruption Doubt state
  const [doubtText, setDoubtText] = useState("");
  const [isResolvingDoubt, setIsResolvingDoubt] = useState(false);
  const [interruptedDoubt, setInterruptedDoubt] = useState<{
    dialogue: string;
    gesture: string;
    whiteboard: any;
    transitionBack: string;
  } | null>(null);

  // Gamified Quiz State
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFilterIndices, setQuizFilterIndices] = useState<number[] | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string>("");

  // Active general view state: "lesson" or "quiz" or "flashcards"
  const [activeTab, setActiveTab] = useState<"lesson" | "flashcards" | "quiz">("lesson");
  const [hasLectureStarted, setHasLectureStarted] = useState(false);

  // Flashcards Review State
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
  const [masteredFlashcards, setMasteredFlashcards] = useState<Set<number>>(new Set());
  const [flashcardFilter, setFlashcardFilter] = useState<"all" | "learning" | "mastered">("all");

  // Avatar Customizer State
  const [avatarSkinColor, setAvatarSkinColor] = useState("#fed7aa");
  const [avatarOutfitColor, setAvatarOutfitColor] = useState("#4f46e5");
  const [avatarHairColor, setAvatarHairColor] = useState("#78350f");
  const [avatarHairStyle, setAvatarHairStyle] = useState("normal");
  const [avatarGlassesColor, setAvatarGlassesColor] = useState("#ef4444");
  const [gender, setTeacherType] = useState<"female" | "male">("female");
  const [teacherVoice, setTeacherVoice] = useState<string>("Aoede");
  const [isCustomizingAvatar, setIsCustomizingAvatar] = useState(false);

  const handleTeacherTypeChange = (type: "female" | "male") => {
    setTeacherType(type);
    if (type === "female") {
      setTeacherVoice("Aoede");
    } else {
      setTeacherVoice("Charon");
    }
  };
  const [isClassroomFullscreen, setIsClassroomFullscreen] = useState(false);

  // AI Visual & Image Studio State
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);
  const [uploadedStudyImage, setUploadedStudyImage] = useState<string | null>(null);
  const [uploadedStudyImageMime, setUploadedStudyImageMime] = useState("");
  const [uploadedStudyImageName, setUploadedStudyImageName] = useState("");
  const [studyImageAnalysis, setStudyImageAnalysis] = useState("");
  const [isAnalyzingStudyImage, setIsAnalyzingStudyImage] = useState(false);
  const [studyImagePrompt, setStudyImagePrompt] = useState("");
  const [copiedStepIndex, setCopiedStepIndex] = useState<number | null>(null);

  // Interactive Homework Coach Chat State (Floating)
  const [isHomeworkChatOpen, setIsHomeworkChatOpen] = useState(false);
  const [isMagicCameraOpen, setIsMagicCameraOpen] = useLocalStorage("isMagicCameraOpen", false);
  const [homeworkChatTheme, setHomeworkChatTheme] = useState<"Default" | "Ocean" | "Forest" | "Sunset">("Default");
  const [playingMessageIdx, setPlayingMessageIdx] = useState<number | null>(null);
  const [audioRef] = useState(new Audio());
  const [homeworkChatMessages, setHomeworkChatMessages] = useState<Array<{
    sender: "user" | "tutor";
    text: string;
    attachedImageName?: string;
    attachedVideoName?: string;
    attachedImageBase64?: string;
    attachedVideoBase64?: string;
    youtubeUrl?: string;
  }>>([
    { sender: "tutor", text: "Hi there! I am your Homework Coach. Got a tough homework problem, equation, or video? Ask me anything, and I'll explain it to you step-by-step!" }
  ]);
  const [homeworkChatInput, setHomeworkChatInput] = useState("");
  const [isHomeworkChatLoading, setIsHomeworkChatLoading] = useState(false);

  // Multi-modal attachment states inside the Homework Coach Chat
  const [attachedImage, setAttachedImage] = useState<{ base64: string, type: string, name: string } | null>(null);
  const [attachedVideo, setAttachedVideo] = useState<{ base64: string, type: string, name: string } | null>(null);
  const [chatYoutubeUrl, setChatYoutubeUrl] = useState("");
  const [isChatRecordingAudio, setIsChatRecordingAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [transcribingAudio, setTranscribingAudio] = useState(false);
  const [isImageGeneratorOpen, setIsImageGeneratorOpen] = useState(false);
  const [imageGeneratorPrompt, setImageGeneratorPrompt] = useState("");
  const [imageGeneratorSize, setImageGeneratorSize] = useState("1K");
  const [imageGeneratorStyle, setImageGeneratorStyle] = useState<"Sketch" | "Diagram" | "Photorealistic">("Diagram");
  const [isGeneratingChatImage, setIsGeneratingChatImage] = useState(false);
  const [chatTab, setChatTab] = useState<"chat" | "gallery">("chat");
  const [generatedImagesList, setGeneratedImagesList] = useState<string[]>([]);
  const [selectedGalleryImageIdx, setSelectedGalleryImageIdx] = useState<number | null>(null);
  const [isAnnotatorActive, setIsAnnotatorActive] = useState(false);

  const chatFeedRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto scroll down chat feed
  useEffect(() => {
    if (chatFeedRef.current && chatTab === "chat") {
      setTimeout(() => {
        if (chatFeedRef.current) {
          chatFeedRef.current.scrollTo({
            top: chatFeedRef.current.scrollHeight,
            behavior: "smooth"
          });
        }
      }, 50);
    }
  }, [homeworkChatMessages, isHomeworkChatOpen, chatTab]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      showToast("Link/Data copied to clipboard!");
    } catch (e) {
      showToast("Failed to copy image to clipboard.");
    }
  };

  const handleShareImage = async (url: string) => {
    if (navigator.share) {
      try {
        if (url.startsWith('data:')) {
          const response = await fetch(url);
          const blob = await response.blob();
          const file = new File([blob], "classroom-diagram.jpg", { type: "image/jpeg" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Study Diagram - ClassroomLM',
              text: 'Check out this generated educational illustration from ClassroomLM!'
            });
            showToast("Shared successfully!");
            return;
          }
        }
        await navigator.share({
          title: 'Study Diagram - ClassroomLM',
          text: 'Check out this generated educational illustration from ClassroomLM!',
          url: url.startsWith('data:') ? undefined : url
        });
        showToast("Shared successfully!");
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          copyToClipboard(url);
        }
      }
    } else {
      copyToClipboard(url);
    }
  };

  const handleDownloadImage = (url: string, filename = "classroom-image.jpg") => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Image download started!");
  };

  const startChatAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options = {};
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          options = { mimeType: "audio/webm" };
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          options = { mimeType: "audio/mp4" };
        }
      }
      const recorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(chunks, { type: mimeType });
        await transcribeChatAudio(audioBlob, mimeType);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsChatRecordingAudio(true);
    } catch (err) {
      console.error("Failed to start audio recording:", err);
      setErrorMsg("Microphone permission denied or not supported.");
    }
  };

  const stopChatAudioRecording = () => {
    if (mediaRecorder && isChatRecordingAudio) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsChatRecordingAudio(false);
      setMediaRecorder(null);
    }
  };

  const transcribeChatAudio = async (blob: Blob, mimeType = "audio/webm") => {
    setTranscribingAudio(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(",")[1];
          if (!trackRequest()) {
            setErrorMsg("Teacher is taking a quick breather. Please wait for the cooldown!");
            return;
          }
          const response = await fetchWithRetry("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: base64Data, mimeType })
          });
          if (response.ok) {
            const data = await response.json();
            if (data.text) {
              setHomeworkChatInput((prev) => prev ? prev + " " + data.text : data.text);
            }
          }
        } catch (innerErr) {
          console.error("Transcription callback failed:", innerErr);
        } finally {
          setTranscribingAudio(false);
        }
      };
    } catch (err) {
      console.error("Transcribe failed:", err);
      setTranscribingAudio(false);
    }
  };

  const handleChatAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      setTranscribingAudio(true);
      try {
        const base64Data = (reader.result as string).split(",")[1];
        if (!trackRequest()) {
            setErrorMsg("Teacher is taking a quick breather. Please wait for the cooldown!");
            return;
          }
          const response = await fetchWithRetry("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64Data, mimeType: file.type })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.text) {
            setHomeworkChatInput((prev) => prev ? prev + " " + data.text : data.text);
          }
        }
      } catch (err) {
        console.error("Failed to transcribe uploaded audio:", err);
      } finally {
        setTranscribingAudio(false);
      }
    };
  };

  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setAttachedImage({
          base64: reader.result,
          type: file.type,
          name: file.name
        });
      }
    };
  };

  const handleChatVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setAttachedVideo({
          base64: reader.result,
          type: file.type,
          name: file.name
        });
      }
    };
  };

  const handleGenerateChatImage = async () => {
    if (!imageGeneratorPrompt.trim()) return;
    setIsGeneratingChatImage(true);
    try {
      const response = await fetchWithRetry("/api/generate-pro-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imageGeneratorPrompt,
          imageSize: imageGeneratorSize,
          aspectRatio: "1:1",
          style: imageGeneratorStyle
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate image.");
      }
      const data = await response.json();
      
      // Store the image in the generated list
      setGeneratedImagesList(prev => [data.imageUrl, ...prev]);
      
      // Post directly to the chat timeline
      setHomeworkChatMessages(prev => [
         ...prev,
         {
           sender: "tutor",
           text: `Here is the ${imageGeneratorStyle.toLowerCase()} illustration you requested: "${imageGeneratorPrompt}"`,
           attachedImageBase64: data.imageUrl
         }
      ]);
      
      setIsImageGeneratorOpen(false);
      setImageGeneratorPrompt("");
    } catch (err: any) {
      alert("Image Generation failed: " + err.message);
    } finally {
      setIsGeneratingChatImage(false);
    }
  };

  const handleStopMessage = () => {
    audioRef.pause();
    audioRef.currentTime = 0;
    setPlayingMessageIdx(null);
  };

  const handlePlayMessage = async (text: string, idx: number) => {
    if (playingMessageIdx === idx) {
      handleStopMessage();
      return;
    }

    handleStopMessage();
    setPlayingMessageIdx(idx);

    try {
      const response = await fetchWithRetry("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: teacherVoice })
      });
      
      if (!response.ok) {
        if (response.status === 429) throw new Error("429");
        throw new Error("TTS failed");
      }
      const data = await response.json();
      
      const audioUrl = `data:audio/wav;base64,${data.audio}`;
      audioRef.src = audioUrl;
      audioRef.onended = () => setPlayingMessageIdx(null);
      await audioRef.play();
    } catch (err: any) {
      console.warn("TTS failed in chat fallback to browser", err);
      speakLessonFallback(text, language, () => {}, () => setPlayingMessageIdx(null));
    }

  };

  const handleSendHomeworkChatMessage = async (overrideQuery?: string | React.MouseEvent | React.KeyboardEvent | React.FormEvent, forceImage?: { base64: string, type: string, name: string }, externalController?: AbortController) => {
    const isOverride = typeof overrideQuery === "string";
    const userQuery = isOverride ? overrideQuery : homeworkChatInput.trim();
    
    const currentAttachedImage = forceImage || (isOverride ? null : attachedImage);
    const currentAttachedVideo = isOverride ? null : attachedVideo;
    const currentYoutubeUrl = isOverride ? "" : chatYoutubeUrl;

    if (!userQuery && !currentAttachedImage && !currentAttachedVideo && !currentYoutubeUrl) return;

    if (!isOverride && !forceImage) {
      // Reset draft attachments immediately for smooth UI feedback
      setHomeworkChatInput("");
      setAttachedImage(null);
      setAttachedVideo(null);
      setChatYoutubeUrl("");
    }

    const newUserMessage = {
      sender: "user" as const,
      text: userQuery || (currentAttachedImage ? `Attached Image: ${currentAttachedImage.name}` : currentAttachedVideo ? `Attached Video: ${currentAttachedVideo.name}` : `Attached YouTube Link`),
      attachedImageName: currentAttachedImage?.name,
      attachedVideoName: currentAttachedVideo?.name,
      attachedImageBase64: currentAttachedImage?.base64,
      attachedVideoBase64: currentAttachedVideo?.base64,
      youtubeUrl: currentYoutubeUrl
    };

    setHomeworkChatMessages((prev) => [...prev, newUserMessage]);
    setIsHomeworkChatLoading(true);

    try {
      if (!trackRequest()) {
        setIsGenerating(false);
        setErrorMsg("Teacher is taking a quick breather. Please wait for the cooldown!");
        return;
      }
      const response = await fetchWithRetry("/api/ask-doubt", {
        signal: externalController?.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doubt: userQuery || "Explain the attached material.",
          language: language,
          gradeLevel: gradeLevel,
          chatHistory: [...homeworkChatMessages, newUserMessage], // include the active message in history
          attachedImage: currentAttachedImage,
          attachedVideo: currentAttachedVideo,
          youtubeUrl: currentYoutubeUrl,
          lessonContext: {
            title: "Homework Helper Chat",
            isSolvingQuiz: false,
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to get response from Homework Coach.");
      }

      const data = await response.json();
      setHomeworkChatMessages((prev) => [...prev, { sender: "tutor", text: data.dialogue }]);
    } catch (err: any) {
      if (err.name === "AbortError") {
        setIsHomeworkChatLoading(false);
        return;
      }
      setHomeworkChatMessages((prev) => [
        ...prev,
        { sender: "tutor", text: err.message || "Oops, I had a little trouble thinking. Could you please try asking your question again?" }
      ]);
    } finally {
      setIsHomeworkChatLoading(false);
    }
  };

  // Playback timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1];
      setUploadedFile({
        name: file.name,
        type: file.type,
        base64: base64String,
      });
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read the file correctly.");
    };
    reader.readAsDataURL(file);
  };

  // Voice Input (Speech Recognition) State for Doubt Box
  const [isListening, setIsListening] = useState(false);
  const [isWaitingForUserVoice, setIsWaitingForUserVoice] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef(false);
  const raiseHandRecorderRef = useRef<MediaRecorder | null>(null);
  const raiseHandChunksRef = useRef<Blob[]>([]);

  const submitDoubtRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      let langCode = "en-US";
      const normLang = language.toLowerCase();
      if (normLang.includes("telugu")) langCode = "te-IN";
      else if (normLang.includes("hindi")) langCode = "hi-IN";
      else if (normLang.includes("spanish")) langCode = "es-ES";
      else if (normLang.includes("french")) langCode = "fr-FR";
      else if (normLang.includes("german")) langCode = "de-DE";
      else if (normLang.includes("japanese")) langCode = "ja-JP";
      
      recognition.lang = langCode;

      recognition.onstart = () => {
        setIsListening(true);
        isRecognitionActiveRef.current = true;
        setIsWaitingForUserVoice(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setDoubtText((prev) => {
            const updated = prev ? prev + " " + transcript : transcript;
            submitDoubtRef.current(updated);
            return updated;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        isRecognitionActiveRef.current = false;
        setIsWaitingForUserVoice(false);
        
        if (event.error === "not-allowed") {
          setErrorMsg("Microphone access is blocked or denied. To use voice doubts, please allow microphone access in your browser's address bar settings.");
        } else if (event.error === "no-speech") {
          // Quietly ignore
        } else {
          setErrorMsg(`Voice search error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        isRecognitionActiveRef.current = false;
        setIsWaitingForUserVoice(false);
      };

      recognitionRef.current = recognition;
    }

    // Clean up on unmount or language change
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [language]);

  // Handle resetting or updating lesson playback state on tab switch back to lesson
  useEffect(() => {
    if (activeTab === "lesson" && lesson) {
      if (currentStepIndex >= lesson.timeline.length - 1) {
        setCurrentStepIndex(0);
        setHasLectureStarted(false);
        setIsPlaying(false);
      }
    }
  }, [activeTab, lesson]);

  // Hook to pause/resume playback on visibility change or tab change
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const wasPlayingRef = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isPlayingRef.current) {
          wasPlayingRef.current = true;
          setIsPlaying(false);
        }
      } else {
        if (wasPlayingRef.current && activeTab === "lesson") {
          setIsPlaying(true);
          wasPlayingRef.current = false;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [activeTab]);


  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if the user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (appStage !== "app" || activeTab !== "lesson" || !lesson) return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        setCurrentStepIndex((prev) => {
          const next = prev + 1;
          return next < lesson.timeline.length ? next : prev;
        });
        setInterruptedDoubt(null);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        setCurrentStepIndex((prev) => {
          const prevIdx = prev - 1;
          return prevIdx >= 0 ? prevIdx : prev;
        });
        setInterruptedDoubt(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appStage, activeTab, lesson]);

  useEffect(() => {
    if (activeTab !== "lesson") {
      if (isPlayingRef.current) {
        wasPlayingRef.current = true;
        setIsPlaying(false);
      }
    } else {
      if (wasPlayingRef.current && !document.hidden) {
        setIsPlaying(true);
        wasPlayingRef.current = false;
      }
    }
  }, [activeTab]);

  const toggleListening = () => {
    const hasMediaDevices = typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (!recognitionRef.current && !hasMediaDevices) {
      setErrorMsg("Voice-to-text recognition and audio recording are not supported in this browser.");
      return;
    }

    if (isListening || isRecognitionActiveRef.current || isWaitingForUserVoice) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (raiseHandRecorderRef.current && raiseHandRecorderRef.current.state !== "inactive") {
        try {
          raiseHandRecorderRef.current.stop();
          raiseHandRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        } catch (e) {}
      }
      setIsListening(false);
      isRecognitionActiveRef.current = false;
      setIsWaitingForUserVoice(false);

      // If the currently interrupted doubt is our voice prompt, clear it to resume normal lesson
      if (interruptedDoubt) {
        const matchingPrompt = ENTHUSIASTIC_PROMPT_BY_LANG[language] || ENTHUSIASTIC_PROMPT_BY_LANG["English"];
        if (interruptedDoubt.dialogue === matchingPrompt) {
          setInterruptedDoubt(null);
        }
      }
    } else {
      setIsPlaying(false);
      setDoubtText("");
      setIsWaitingForUserVoice(true);

      const currentWhiteboard = lesson?.timeline[currentStepIndex]?.whiteboardContent || {
        heading: "Raise Hand Mic Live",
        bulletPoints: ["Ready to listen. Please speak your doubt clearly..."]
      };

      const promptText = ENTHUSIASTIC_PROMPT_BY_LANG[language] || ENTHUSIASTIC_PROMPT_BY_LANG["English"];

      setInterruptedDoubt({
        dialogue: promptText,
        gesture: "questioning",
        whiteboard: currentWhiteboard,
        transitionBack: ""
      });
    }
  };

  const handleDoubtPromptComplete = async () => {
    if (!isWaitingForUserVoice) return;

    if (recognitionRef.current) {
      if (!isListening && !isRecognitionActiveRef.current) {
        try {
          setIsListening(true);
          isRecognitionActiveRef.current = true;
          recognitionRef.current.start();
        } catch (error: any) {
          console.error("Failed to start speech recognition after prompt completion:", error);
          setIsListening(false);
          isRecognitionActiveRef.current = false;
          setIsWaitingForUserVoice(false);
        }
      }
    } else {
      // Robust standard fallback: Use MediaRecorder for recording + server-side transcription!
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        raiseHandChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) raiseHandChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          setIsListening(false);
          const audioBlob = new Blob(raiseHandChunksRef.current, { type: "audio/webm" });
          setIsHomeworkChatLoading(true); // show loading state in Homework/Study Coach
          try {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
              try {
                const base64Data = (reader.result as string).split(",")[1];
                if (!trackRequest()) {
            setErrorMsg("Teacher is taking a quick breather. Please wait for the cooldown!");
            return;
          }
          const response = await fetchWithRetry("/api/transcribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ audio: base64Data, mimeType: "audio/webm" })
                });
                if (response.ok) {
                  const data = await response.json();
                  if (data.text) {
                    setDoubtText(data.text);
                    submitDoubt(data.text); // auto submit transcribed doubt!
                  }
                }
              } catch (transcribeErr) {
                console.error("Failed raise-hand fallback transcription:", transcribeErr);
              } finally {
                setIsHomeworkChatLoading(false);
              }
            };
          } catch (err) {
            console.error("Error reading fallback audio:", err);
            setIsHomeworkChatLoading(false);
          }
        };

        raiseHandRecorderRef.current = recorder;
        recorder.start();
        setIsListening(true);
        setIsWaitingForUserVoice(false);
      } catch (err: any) {
        console.error("Failed to start raise-hand fallback recording:", err);
        setErrorMsg("Failed to start microphone recording: " + (err.message || "access denied"));
        setIsListening(false);
        setIsWaitingForUserVoice(false);
      }
    }
  };

  // Image Generation and Multimodal Study Image Analysis Handlers
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    setGeneratedImageUrl("");
    setErrorMsg("");
    try {
      const res = await fetchWithRetry("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt, aspectRatio: "1:1" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate educational image.");
      }
      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to generate image.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleStudyImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadedStudyImageName(file.name);
    setUploadedStudyImageMime(file.type);
    
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const base64 = reader.result.split(",")[1];
        setUploadedStudyImage(base64);
        setStudyImageAnalysis("");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeStudyImage = async () => {
    if (!uploadedStudyImage) return;
    setIsAnalyzingStudyImage(true);
    setStudyImageAnalysis("");
    setErrorMsg("");
    try {
      const res = await fetchWithRetry("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: studyImagePrompt || "Analyze this image, diagram, or homework sheet. Identify key educational concepts, parse any text, and explain the subject material in clear, engaging detail for school students.",
          imageBase64: uploadedStudyImage,
          mimeType: uploadedStudyImageMime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze study image.");
      }
      if (data.analysis) {
        setStudyImageAnalysis(data.analysis);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to analyze study image.");
    } finally {
      setIsAnalyzingStudyImage(false);
    }
  };

  // State & logic for Microphone audio material recording & transcribing
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const audioMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      let options = {};
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          options = { mimeType: "audio/webm" };
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          options = { mimeType: "audio/mp4" };
        }
      }
      const mediaRecorder = new MediaRecorder(stream, options);
      audioMediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const recMime = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: recMime });
        stream.getTracks().forEach((track) => track.stop());

        setTranscriptionLoading(true);
        setErrorMsg("");

        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            try {
              const base64Data = (reader.result as string).split(",")[1];
              
              if (!trackRequest()) {
            setErrorMsg("Teacher is taking a quick breather. Please wait for the cooldown!");
            return;
          }
          const response = await fetchWithRetry("/api/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audio: base64Data,
                  mimeType: recMime,
                }),
              });

              if (!response.ok) {
                throw new Error("Failed to transcribe. The recording may be too short or unclear.");
              }

              const result = await response.json();
              if (result.text) {
                if (optionsTab === "tutor") {
                  setPastedText((prev) => (prev ? prev + "\n" + result.text : result.text));
                } else {
                  setHomeworkText((prev) => (prev ? prev + "\n" + result.text : result.text));
                }
              } else {
                setErrorMsg("We couldn't detect any spoken words. Try speaking louder or closer to the microphone.");
              }
            } catch (innerErr: any) {
              console.error("Transcription error:", innerErr);
              setErrorMsg(innerErr.message || "Could not transcribe microphone audio. Please try again.");
            } finally {
              setTranscriptionLoading(false);
            }
          };
        } catch (err: any) {
          console.error("FileReader error:", err);
          setErrorMsg("Could not transcribe microphone audio. Please try again.");
          setTranscriptionLoading(false);
        }
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
    } catch (err: any) {
      console.error("Mic access denied:", err);
      setErrorMsg("Microphone access is required for voice recording and transcription.");
    }
  };

  const stopAudioRecording = () => {
    if (audioMediaRecorderRef.current && isRecordingAudio) {
      audioMediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  };

  // State & logic for Video analysis using gemini-3.1-pro-preview
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [videoAnalysisResult, setVideoAnalysisResult] = useState<{
    summary: string;
    keyConcepts: Array<{ concept: string; definition: string }>;
    vocabulary: Array<{ word: string; definition: string }>;
  } | null>(null);

  useEffect(() => {
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    if (ytRegex.test(youtubeUrl) && !isAnalyzingVideo && !videoAnalysisResult) {
      const timeoutId = setTimeout(() => {
        analyzeVideoContent();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [youtubeUrl, isAnalyzingVideo, videoAnalysisResult]);

  const analyzeVideoContent = async () => {
    if (!youtubeUrl.trim() && !uploadedFile) {
      setErrorMsg("Please provide a YouTube URL or upload a video file to analyze first.");
      return;
    }

    setIsAnalyzingVideo(true);
    setErrorMsg("");
    setVideoAnalysisResult(null);

    try {
      const response = await fetchWithRetry("/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl: youtubeUrl,
          uploadedFile: uploadedFile,
          language: language,
        }),
      });

      if (!response.ok) {
        throw new Error("Video analysis failed. Please verify the URL or uploaded video format.");
      }

      const data = await response.json();
      
      if (data.lessonFocus || data.suggestedTitle) {
        setCustomTopic(data.lessonFocus || data.suggestedTitle);
      }
      if (data.gradeLevel) {
        setGradeLevel(data.gradeLevel);
      }

      setVideoAnalysisResult({
        summary: data.summary,
        keyConcepts: data.keyConcepts || [],
        vocabulary: data.vocabulary || [],
      });

      // Format as beautiful, rich markdown context inside pastedText
      let guide = `=== VIDEO KEY STUDY GUIDE ===\n\n`;
      if (data.studyMaterials) {
        guide += `**Study Materials / Focus:**\n${data.studyMaterials}\n\n`;
      }
      guide += `**Summary of Video Content:**\n${data.summary}\n\n`;
      
      if (data.keyConcepts && data.keyConcepts.length > 0) {
        guide += `**Core Concepts Explained:**\n`;
        data.keyConcepts.forEach((c: any) => {
          guide += `* ${c.concept}: ${c.definition}\n`;
        });
        guide += `\n`;
      }

      if (data.vocabulary && data.vocabulary.length > 0) {
        guide += `**Key Terminology & Vocabulary:**\n`;
        data.vocabulary.forEach((v: any) => {
          guide += `* ${v.word}: ${v.definition}\n`;
        });
      }

      setPastedText(guide);
    } catch (err: any) {
      console.error("Video analysis error:", err);
      setErrorMsg(err.message || "Failed to analyze video content.");
    } finally {
      setIsAnalyzingVideo(false);
    }
  };

  // Handler for advancing when the teacher finishes speaking (or simulated timer completes)
  const handleStepComplete = () => {
    if (!lesson || activeTab !== "lesson" || interruptedDoubt) return;
    if (currentStepIndex < lesson.timeline.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      // Switch to the next step without pausing
      // setIsPlaying(false);
    } else {
      // Finished all parts, transition to interactive quiz
      setIsPlaying(false);
      setActiveTab("quiz");
    }
  };

  // Automatically extract high-quality active-recall flashcards from the current lesson
  const generateFlashcards = (lessonObj: Lesson): Array<{ id: number; front: string; back: string; category: string }> => {
    const cards: Array<{ id: number; front: string; back: string; category: string }> = [];
    let idCounter = 1;

    if (!lessonObj) return cards;

    // 1. Parse whiteboard concepts
    lessonObj.timeline.forEach((step, index) => {
      const heading = step.whiteboardContent.heading;
      const bulletPoints = step.whiteboardContent.bulletPoints || [];
      
      // Try parsing key terms with definitions (e.g., separated by a colon or dash)
      let definitionFound = false;
      bulletPoints.forEach(point => {
        const parts = point.split(/[:\u2014-]/);
        if (parts.length >= 2 && parts[0].trim().length > 2 && parts[0].trim().length < 40 && parts[1].trim().length > 10) {
          cards.push({
            id: idCounter++,
            front: parts[0].trim(),
            back: parts[1].trim(),
            category: `Core Term (Part ${index + 1})`
          });
          definitionFound = true;
        }
      });
      
      // Add general step review if there is content
      if (bulletPoints.length > 0) {
        cards.push({
          id: idCounter++,
          front: `Concept Check: What is the main idea of "${heading}"?`,
          back: bulletPoints.map(bp => `• ${bp}`).join("\n"),
          category: `Concept Review (Part ${index + 1})`
        });
      }
    });
    
    // 2. Parse quiz questions as active-recall cards
    lessonObj.quiz.forEach((q, index) => {
      cards.push({
        id: idCounter++,
        front: `Active Recall: ${q.question}`,
        back: `Correct Answer: ${q.options[q.correctIndex]}\n\nTeacher Feedback: ${q.explanation}`,
        category: `Quiz Preparation (Q${index + 1})`
      });
    });

    // Fallback card if somehow empty
    if (cards.length === 0) {
      cards.push({
        id: idCounter++,
        front: lessonObj.title,
        back: lessonObj.description,
        category: "General Overview"
      });
    }

    return cards;
  };

  // Generate a clean, structured multi-page PDF summary of the lesson
  const downloadLessonSummaryPDF = () => {
    if (!lesson) return;
    
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;
    let pageNum = 1;

    const drawFooter = (pNum: number) => {
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${pNum}`, pageWidth - margin - 10, pageHeight - 10);
      doc.text(`${lesson.title} - AI Classroom Study Summary`, margin, pageHeight - 10);
    };

    const checkPageOverflow = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin - 10) {
        drawFooter(pageNum);
        doc.addPage();
        pageNum++;
        y = margin + 10;
      }
    };

    // Header Title Block
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo-600
    
    const titleLines = doc.splitTextToSize(lesson.title, contentWidth);
    titleLines.forEach((line: string) => {
      checkPageOverflow(10);
      doc.text(line, margin, y);
      y += 8;
    });
    y += 2;
    
    // Subtitle Info
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Gray-500
    const subtitleText = `Grade Level: ${gradeLevel}  |  Language: ${language}  |  Generated on ${new Date().toLocaleDateString()}`;
    checkPageOverflow(6);
    doc.text(subtitleText, margin, y);
    y += 6;

    // Divider line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    checkPageOverflow(5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Description
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105); // Slate-600
    const descLines = doc.splitTextToSize(lesson.description, contentWidth);
    descLines.forEach((line: string) => {
      checkPageOverflow(8);
      doc.text(line, margin, y);
      y += 6;
    });
    y += 10;

    // Section 1: Lecture Timeline Key Concepts
    checkPageOverflow(15);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text("Interactive Lecture & Key Concepts", margin, y);
    y += 6;
    
    doc.setDrawColor(99, 102, 241); // Indigo-500
    doc.setLineWidth(1.5);
    doc.line(margin, y, margin + 40, y);
    y += 8;

    lesson.timeline.forEach((step, idx) => {
      // Step Title
      checkPageOverflow(15);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text(`Part ${idx + 1}: ${step.whiteboardContent.heading}`, margin, y);
      y += 6;

      // Spoken explanation
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // Slate-700
      const cleanDialogue = step.spokenDialogue.replace(/\[.*?\]/g, "").trim();
      const speakLines = doc.splitTextToSize(`Explanation: ${cleanDialogue}`, contentWidth);
      speakLines.forEach((line: string) => {
        checkPageOverflow(6);
        doc.text(line, margin, y);
        y += 5;
      });
      y += 2;

      // Bullet points
      if (step.whiteboardContent.bulletPoints && step.whiteboardContent.bulletPoints.length > 0) {
        checkPageOverflow(8);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // Slate-900
        doc.text("Key Takeaways:", margin + 4, y);
        y += 5;

        doc.setFont("Helvetica", "normal");
        step.whiteboardContent.bulletPoints.forEach((bp) => {
          const bpLines = doc.splitTextToSize(`• ${bp}`, contentWidth - 8);
          bpLines.forEach((line: string) => {
            checkPageOverflow(6);
            doc.text(line, margin + 8, y);
            y += 5;
          });
        });
      }
      
      y += 8; // spacing between parts
    });

    // Section 2: Assessment Challenge
    if (lesson.quiz && lesson.quiz.length > 0) {
      checkPageOverflow(25);
      y += 4;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("Self-Assessment & Active Recall Challenge", margin, y);
      y += 6;

      doc.setDrawColor(245, 158, 11); // Amber-500
      doc.setLineWidth(1.5);
      doc.line(margin, y, margin + 40, y);
      y += 8;

      lesson.quiz.forEach((q, idx) => {
        checkPageOverflow(18);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        
        const qLines = doc.splitTextToSize(`Question ${idx + 1}: ${q.question}`, contentWidth);
        qLines.forEach((line: string) => {
          checkPageOverflow(6);
          doc.text(line, margin, y);
          y += 5.5;
        });

        // Options
        q.options.forEach((opt, optIdx) => {
          const isCorrect = optIdx === q.correctIndex;
          doc.setFont("Helvetica", isCorrect ? "bold" : "normal");
          if (isCorrect) {
            doc.setTextColor(22, 163, 74); // Green-600
          } else {
            doc.setTextColor(71, 85, 105); // Slate-600
          }
          
          const optText = `${String.fromCharCode(65 + optIdx)}) ${opt} ${isCorrect ? " (Correct Answer)" : ""}`;
          const optLines = doc.splitTextToSize(optText, contentWidth - 6);
          optLines.forEach((line: string) => {
            checkPageOverflow(5);
            doc.text(line, margin + 6, y);
            y += 5;
          });
        });

        // Explanation text
        y += 2.5;
        checkPageOverflow(12);
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139); // Gray-500
        const expLines = doc.splitTextToSize(`Teacher Feedback: ${q.explanation}`, contentWidth - 6);
        expLines.forEach((line: string) => {
          checkPageOverflow(5);
          doc.text(line, margin + 6, y);
          y += 4.5;
        });

        y += 8; // spacing between quiz questions
      });
    }

    // Save PDF
    drawFooter(pageNum);
    const pdfName = `${lesson.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_lesson_summary.pdf`;
    doc.save(pdfName);
  };

  // Submit study materials to the backend AI Lesson Generator
  const generateNewLesson = async (overrideTopic?: string) => {
    const isHomeworkMode = optionsTab === "homework";

    if (isHomeworkMode) {
      if (!homeworkText && !homeworkFile && !homeworkAudioFile) {
        setErrorMsg("Please provide your homework problem (write text, upload a photo, or dictate audio).");
        return;
      }
    } else {
      if (!pastedText && !youtubeUrl && !uploadedFile && !(overrideTopic || customTopic)) {
        setErrorMsg("Please provide at least a Topic, text, file attachment, or YouTube link.");
        return;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setErrorMsg("");
    setLesson(null);
    setInterruptedDoubt(null);
    setDoubtText("");
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizFilterIndices(null);
    setQuizFeedback("");
    setActiveTab("lesson");
    setCurrentStepIndex(0);
    setIsPlaying(false);

    try {
      // If homework mode is active, prepare payload
      const payload = isHomeworkMode ? {
        pastedText: homeworkText,
        youtubeUrl: "",
        uploadedFile: homeworkFile || homeworkAudioFile,
        language,
        gradeLevel,
        customTopic: homeworkText ? "Homework Assignment: " + homeworkText.slice(0, 40) + "..." : "Homework Problem",
        isHomeworkMode: true,
        voice: teacherVoice,
      } : {
        pastedText,
        youtubeUrl,
        uploadedFile,
        language,
        gradeLevel,
        customTopic: overrideTopic || customTopic,
        isHomeworkMode: false,
        voice: teacherVoice,
      };

      
      if (!trackRequest()) {
        setIsGenerating(false);
        setErrorMsg("Teacher is taking a quick breather. Please wait for the cooldown!");
        return;
      }
      const response = await fetchWithRetry("/api/generate-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Server had an issue starting your study lesson generation.");
      }
      const { jobId } = await response.json();
      
      // Poll for job status
      let data = null;
      while (true) {
        if (controller.signal.aborted) throw new Error("AbortError");
        
        const statusRes = await fetchWithRetry(`/api/job-status?id=${jobId}`);
        if (!statusRes.ok) throw new Error("Failed to check job status");
        
        const statusData = await statusRes.json();
        if (statusData.status === 'completed') {
          data = statusData.data;
          break;
        } else if (statusData.status === 'error') {
          throw new Error(statusData.error || "Generation failed.");
        }
        
        // Wait 1 second before polling again
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!data.timeline || data.timeline.length === 0) {
        throw new Error("No timeline elements returned. Please clarify your study request.");
      }

      setLesson(data);
      setIsLeftPanelCollapsed(true); // Auto-hide left panel after creating lecture
      setHasLectureStarted(false);
      setIsPlaying(false);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Lecture generation aborted.");
        return;
      }
      console.error(err);
      setErrorMsg(err.message || "Failed to transform materials to lesson. Please retry.");
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
    }
  };

  // Resets the workspace for a brand new lecture configuration
  const startNewLecture = () => {
    if (isGenerating) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsGenerating(false);

      // Save the preparing classroom to saved lectures
      const preparingTitle = customTopic || (pastedText ? pastedText.slice(0, 30) + "..." : "") || "Preparing Lecture...";
      const placeholderLesson: Lesson = {
        title: preparingTitle,
        description: "This lecture was saved while preparing. Click 'Generate AI Lesson' on the left to finish preparing it!",
        timeline: [
          {
            timestamp: "0:00",
            teacherGesture: "idle",
            spokenDialogue: "This classroom was saved while preparing. Please click 'Generate AI Lesson' on the left to start the preparation!",
            bubbleCaption: "Interrupted Preparation",
            translationText: "",
            whiteboardContent: {
              heading: "Interrupted Preparation",
              bulletPoints: [
                "This lecture was saved before the AI finished preparing it.",
                "To complete preparation, use the options panel on the left and click 'Generate AI Lesson'.",
                "All your original study materials and settings have been restored."
              ]
            }
          }
        ],
        quiz: []
      };

      setSavedLectures((prev) => [
        {
          id: Date.now().toString(),
          title: preparingTitle,
          lesson: placeholderLesson,
          timestamp: Date.now(),
          inputs: {
            customTopic,
            pastedText,
            youtubeUrl,
            websiteUrl,
            audioFile,
            language
          }
        },
        ...prev
      ]);
    } else if (lesson) {
      setSavedLectures((prev) => [
        {
          id: Date.now().toString(),
          title: lesson.title,
          lesson: lesson,
          timestamp: Date.now(),
          inputs: {
            customTopic,
            pastedText,
            youtubeUrl,
            websiteUrl,
            audioFile,
            language
          }
        },
        ...prev
      ]);
    }
    setLesson(null);
    setCustomTopic("");
    setPastedText("");
    setYoutubeUrl("");
    setWebsiteUrl("");
    setAudioFile(null);
    setUploadedFile(null);
    // Reset homework assist inputs and image analyzer states
    setHomeworkText("");
    setHomeworkFile(null);
    setHomeworkAudioFile(null);
    setUploadedStudyImage(null);
    setUploadedStudyImageName("");
    setUploadedStudyImageMime("");
    setStudyImageAnalysis("");
    setStudyImagePrompt("");
    setErrorMsg("");
    setDoubtText("");
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizFilterIndices(null);
    setQuizFeedback("");
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setIsLeftPanelCollapsed(false); // Open the panel back up for layout
  };

  const restoreSavedLecture = (savedId: string) => {
    const lecture = savedLectures.find(l => l.id === savedId);
    if (!lecture) return;
    
    setLesson(lecture.lesson);
    setCustomTopic(lecture.inputs.customTopic);
    setPastedText(lecture.inputs.pastedText);
    setYoutubeUrl(lecture.inputs.youtubeUrl);
    setWebsiteUrl(lecture.inputs.websiteUrl);
    setAudioFile(lecture.inputs.audioFile);
    setLanguage(lecture.inputs.language);
    
    setUploadedFile(null);
    setErrorMsg("");
    setDoubtText("");
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizFilterIndices(null);
    setQuizFeedback("");
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  const deleteSavedLecture = (savedId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setSavedLectures((prev) => prev.filter(l => l.id !== savedId));
  };

  // Mid-Lesson doubt interruption handler (CRITICAL)
  const submitDoubt = async (directText?: string) => {
    const finalDoubt = directText !== undefined ? directText : doubtText;
    if (!finalDoubt.trim() || !lesson) return;

    // Turn off mic/listening state immediately
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (raiseHandRecorderRef.current && raiseHandRecorderRef.current.state !== "inactive") {
      try {
        raiseHandRecorderRef.current.stop();
        raiseHandRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      } catch (e) {}
    }
    setIsListening(false);
    isRecognitionActiveRef.current = false;
    setIsWaitingForUserVoice(false);
    setDoubtText("");

    setIsPlaying(false); // Pause main playback
    setIsResolvingDoubt(true);
    setErrorMsg("");

    const currentWhiteboard = lesson.timeline[currentStepIndex]?.whiteboardContent;

    try {
      if (!trackRequest()) {
        setIsGenerating(false);
        return;
      }
      const response = await fetchWithRetry("/api/ask-doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doubt: finalDoubt,
          lessonContext: {
            title: lesson.title,
            currentWhiteboard,
            isSolvingQuiz: activeTab === "quiz",
            quiz: lesson.quiz,
          },
          language,
          gradeLevel,
        }),
      });

      if (!response.ok) {
        throw new Error("The AI Teacher is busy. Please try asking your doubt again.");
      }

      const data = await response.json();
      setDoubtsResolved(prev => prev + 1);
      setInterruptedDoubt({
        dialogue: data.dialogue,
        gesture: data.teacherGesture || "explaining",
        whiteboard: data.whiteboardChanges || currentWhiteboard,
        transitionBack: data.transitionBack,
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to get an answer for your doubt.");
    } finally {
      setIsResolvingDoubt(false);
    }
  };

  useEffect(() => {
    submitDoubtRef.current = submitDoubt;
  }, [submitDoubt]);

  const resolveDoubtAndResume = () => {
    setInterruptedDoubt(null);
    setDoubtText("");
    setIsPlaying(true);
    setDoubtsResolved((prev) => prev + 1);
  };

  // Multi choice selection handler
  const handleSelectQuizOption = (questionIndex: number, optionIndex: number) => {
    if (quizSubmitted) return;
    setQuizAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const triggerGoldenStickerConfetti = () => {
    // 1. Initial grand burst from center
    confetti({
      particleCount: 160,
      spread: 100,
      origin: { y: 0.6 },
      colors: ["#fbbf24", "#f59e0b", "#fb7185", "#818cf8", "#34d399", "#a855f7"]
    });

    // 2. Cascade multiple side bursts for continuous celebration
    const duration = 3.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.85 },
        colors: ["#fbbf24", "#f59e0b", "#fb7185", "#a855f7", "#34d399"]
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.85 },
        colors: ["#fbbf24", "#f59e0b", "#fb7185", "#a855f7", "#34d399"]
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Delay the sides fountains slightly for optimal cinematic impact
    setTimeout(() => {
      frame();
    }, 250);
  };

  // Validate Score & Submit
  const checkQuizResults = () => {
    if (!lesson) return;
    let score = 0;
    lesson.quiz.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctIndex) {
        score++;
      }
    });
    setQuizScore(score);
    setQuizSubmitted(true);

    // Generate custom encouraging teacher feedback
    const feedback = generateTeacherFeedback(score, lesson.quiz.length, quizAnswers, lesson.quiz);
    setQuizFeedback(feedback);

    // Trigger gamified celebratory confetti on perfect score!
    if (score === lesson.quiz.length && lesson.quiz.length > 0) {
      triggerGoldenStickerConfetti();
    }
  };

  const generateTeacherFeedback = (score: number, total: number, answers: { [key: number]: number }, questions: any[]) => {
    if (total === 0) return "";
    const percentage = (score / total) * 100;
    
    // Identify incorrect questions
    const incorrectQuestions = questions.filter((q, idx) => answers[idx] !== q.correctIndex);
    
    if (percentage === 100) {
      return `⭐ **Outstanding Work!** You scored a perfect **${score}/${total}**! Your understanding of **${lesson?.title || "the topic"}** is absolutely brilliant. You've officially earned the **Golden Classroom Sticker**! 🏆 Keep up this incredible academic momentum!`;
    } else if (percentage >= 70) {
      let base = `🌟 **Superb Effort!** You scored **${score}/${total}**. You have a solid grasp of this lesson, with just a few minor details to polish up. You've already got the toughest questions correct! Let's get you to 100% mastery.`;
      if (incorrectQuestions.length > 0) {
        const randomQ = incorrectQuestions[Math.floor(Math.random() * incorrectQuestions.length)];
        const shortQ = randomQ.question.length > 65 ? randomQ.question.substring(0, 62) + "..." : randomQ.question;
        base += `\n\n*Teacher's Advice:* Take a close look at the question on **"${shortQ}"**—you are just one quick review away from nailing it! Click **'Retry Incorrect'** to try again!`;
      }
      return base;
    } else {
      let base = `🌱 **Well Tried!** You scored **${score}/${total}**. Learning is a continuous journey, and every mistaken answer is a valuable clue showing us where to explore next. I know you have the potential to conquer this topic!`;
      if (incorrectQuestions.length > 0) {
        const firstQ = incorrectQuestions[0];
        const shortQ = firstQ.question.length > 65 ? firstQ.question.substring(0, 62) + "..." : firstQ.question;
        base += `\n\n*Teacher's Advice:* Let's tackle the question about **"${shortQ}"** together. Click **'Retry Incorrect'** and let's solve those remaining questions one-by-one with 100% focus!`;
      }
      return base;
    }
  };

  const handleRetryIncorrectQuestions = () => {
    if (!lesson) return;
    const incorrectIndices = lesson.quiz
      .map((q, idx) => quizAnswers[idx] !== q.correctIndex ? idx : -1)
      .filter(idx => idx !== -1);
    
    if (incorrectIndices.length === 0) return;
    
    // Set filter to only incorrect indices
    setQuizFilterIndices(incorrectIndices);
    
    // Clear only incorrect answers from quizAnswers
    setQuizAnswers((prev) => {
      const updated = { ...prev };
      incorrectIndices.forEach((idx) => {
        delete updated[idx];
      });
      return updated;
    });
    
    // Reset submission status so user can solve them again
    setQuizSubmitted(false);
    showToast("🎯 Loaded incorrect questions for retry! Keep going!");
  };

  const handleShowAllQuizQuestions = () => {
    setQuizFilterIndices(null);
  };

  // Seed standard example lessons for fast demonstration
  const loadQuickDemo = (topic: string) => {
    setCustomTopic(topic);
    if (topic === "Photosynthesis Process") {
      setLanguage("English");
      setGradeLevel("5th Grade");
      setPastedText("Photosynthesis is how green plants make food. It takes place inside leaves in tiny organelles called chloroplasts. These contain chlorophyll, which absorbs blue and red wavelengths of light from the sun, reflecting green. Plants absorb water through roots, carbon dioxide through pores called stomata, and lock sunlight energy to produce glucose sugar and oxygen gas. The chemical formula is 6CO2 + 6H2O + light -> C6H12O6 + 6O2.");
    } else if (topic === "Newton's 3 Laws of Motion") {
      setLanguage("English");
      setGradeLevel("7th Grade");
      setPastedText("Newton's Laws of motion explain everything about forces. 1. Law of Inertia: An object stays still unless pushed. 2. F = ma: Force equals mass times acceleration. Pushing heavier things requires more force. 3. Action & Reaction: For every force, there is an equal and opposite reaction force.");
    } else if (topic === "Ancient Egyptian Pyramids") {
      setLanguage("Spanish");
      setGradeLevel("9th Grade");
      setPastedText("Las pirámides de Giza fueron construidas hace más de 4500 años como tumbas monumentales para los faraones Keops, Kefrén y Micerino. Requirieron miles de constructores hábiles que cortaban bloques masivos de piedra caliza.");
    }
  };


  const appContent = (() => {


    if (appStage === "path") {
      return (
        <StudyPathMap 
          topic={customTopic}
          gradeLevel={gradeLevel}
          language={language}
          onSelectTopic={(t) => {
            setCustomTopic(t);
            setOptionsTab("tutor");
            setPastedText("");
            setAppStage("app");
            generateNewLesson(t);
          }}
          isDarkMode={isDarkMode}
          onBack={() => setAppStage("app")}
        />
      );
    }

    return (
      <div className={`relative flex flex-col h-[100dvh] w-[100dvw] fixed font-sans transition-colors duration-300 overflow-hidden ${
        isDarkMode ? "text-slate-100 bg-transparent" : "text-slate-800 bg-transparent"
      }`}>
      <AppBackground isDarkMode={isDarkMode} />

      {/* Dynamic Header */}
      <header className={`relative h-16 border-b border-white/20 flex items-center justify-between px-6 z-20 shrink-0 shadow-md transition-colors duration-300 backdrop-blur-2xl ${
        isDarkMode ? "bg-slate-900/80 border-indigo-500/30" : "bg-white/80 border-indigo-200/50"
      }`}>
        <div className="flex items-center gap-4">
          {/* Options button (3 horizontal lines) mimicking Gemini */}
          <button
            onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
            className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors bg-transparent border-none cursor-pointer select-none flex items-center justify-center outline-none focus:outline-none"
            title={isLeftPanelCollapsed ? "Expand Options Panel" : "Collapse Options Panel"}
          >
            <Menu className="w-6 h-6 stroke-[2]" />
          </button>

          <div className="flex items-center gap-3">
            <motion.div layoutId="app-logo">
              <img src="/logo512.svg" className="w-10 h-10 drop-shadow-md" alt="ClassroomLM Logo" />
            </motion.div>
            <div>
              <motion.h1 
                animate={{
                  textShadow: [
                    "0px 0px 0px rgba(59, 130, 246, 0)",
                    "0px 0px 15px rgba(59, 130, 246, 0.5)",
                    "0px 0px 0px rgba(59, 130, 246, 0)"
                  ],
                  scale: [1, 1.02, 1]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className={`text-2xl font-black tracking-tight font-display transition-colors ${
                  isDarkMode ? "text-blue-400" : "text-blue-600"
                }`}
              >
                Classroom<span className="text-orange-500">LM</span>
              </motion.h1>
              <p className={`text-[10px] font-bold -mt-1 tracking-wider uppercase transition-colors ${
                isDarkMode ? "text-slate-400" : "text-gray-500"
              }`}>
                Animated Interactive AI Tutor
              </p>
            </div>
          </div>
        </div>

        {/* Status indicator / current study mode / theme switcher */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAppStage("path")}
            className={`px-3 py-1.5 rounded-xl border-2 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
              isDarkMode
                ? "bg-purple-900/30 border-purple-500/50 text-purple-300 hover:bg-purple-900/50"
                : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
            }`}
          >
            <Map className="w-4 h-4" />
            <span className="hidden sm:inline">My Journey</span>
          </button>
          
          {/* Light/Dark Mode Switcher */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`px-2 py-1.5 sm:px-3 rounded-xl border-2 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
              isDarkMode
                ? "bg-slate-850 border-slate-700 text-yellow-400 hover:bg-slate-800"
                : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
            }`}
            title="Toggle Light/Dark Theme"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                <span className="text-[11px] hidden sm:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-[11px] hidden sm:inline">Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Split-View Layout */}
      <main className="relative z-10 flex-1 flex overflow-hidden">
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }} className="w-full h-full flex absolute inset-0">
        
        {/* Left Panel: Control Dashboard */}
        <aside className={`relative z-10 ${isLeftPanelCollapsed ? "w-0 p-0 overflow-hidden border-r-0" : "w-96 border-r-4 p-5"} flex flex-col gap-5 shrink-0 overflow-y-auto transition-all duration-300 backdrop-blur-2xl ${
          isDarkMode
            ? "bg-slate-900/80 border-indigo-600/50 text-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.5)]"
            : "bg-white/80 border-yellow-400/50 text-slate-800 shadow-[4px_0_24px_rgba(0,0,0,0.1)] [background-image:radial-gradient(#e0f2fe_1.5px,transparent_1.5px)] [background-size:24px_24px]"
        }`}>
          
          {/* Panel Header & New Lecture option */}
          <div className="flex items-center justify-between pb-2 border-b border-dashed border-gray-200 dark:border-slate-800 shrink-0">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-500">
              ⚙️ OPTIONS
            </span>
            <button
              onClick={startNewLecture}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border-2 transition-all hover:scale-[1.03] active:scale-[0.97] ${
                isDarkMode
                  ? "bg-orange-950/40 border-orange-850 text-orange-400 hover:bg-orange-900/60"
                  : "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
              }`}
              title="Clear current lesson and prepare a new custom lecture"
            >
              <Library className="w-3 h-3" />
              <span>New Lecture</span>
            </button>
          </div>
          
          {/* Saved Lectures */}
          {savedLectures.length > 0 && (
            <div>
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 block">
                💾 Saved Lectures
              </label>
              <div className="flex flex-col gap-1.5">
                {savedLectures.map((lecture) => (
                  <div
                    key={lecture.id}
                    className={`group relative flex items-center justify-between pl-3 pr-2 py-1.5 rounded-xl transition-all border ${
                      isDarkMode
                        ? "bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600"
                        : "bg-gray-50 hover:bg-white text-gray-700 border-gray-200 hover:border-gray-300 shadow-sm"
                    }`}
                  >
                    <button
                      onClick={() => restoreSavedLecture(lecture.id)}
                      className="flex-1 text-left truncate pr-2 py-0.5 cursor-pointer focus:outline-none"
                      title="Click to restore this saved lecture"
                    >
                      <span className="truncate block text-xs font-bold leading-tight">
                        {lecture.title || lecture.inputs.customTopic || "Untitled Lecture"}
                      </span>
                      <span className="text-[9px] text-gray-400 block font-medium mt-0.5">
                        Saved at {new Date(lecture.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        if (confirm("Are you sure you want to delete this saved lecture?")) {
                          deleteSavedLecture(lecture.id, e);
                        }
                      }}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer opacity-100 sm:opacity-40 group-hover:opacity-100 ${
                        isDarkMode
                          ? "text-slate-400 hover:text-red-400 hover:bg-slate-700/50"
                          : "text-gray-400 hover:text-red-500 hover:bg-gray-100"
                      }`}
                      title="Delete Saved Lecture"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Classroom Tutor vs Homework Buddy Sub-tabs */}
          <div className={`p-1 rounded-2xl flex border-2 transition-all shrink-0 ${
            isDarkMode ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
          }`}>
            <button
              onClick={() => {
                setOptionsTab("tutor");
                setErrorMsg("");
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                optionsTab === "tutor"
                  ? "bg-indigo-600 text-white shadow-md"
                  : isDarkMode
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lesson Tutor</span>
            </button>
            <button
              onClick={() => {
                setOptionsTab("homework");
                setErrorMsg("");
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                optionsTab === "homework"
                  ? "bg-indigo-600 text-white shadow-md"
                  : isDarkMode
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Homework Assist</span>
            </button>
          </div>

          {/* Configuration Parameters (Shared) */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">
                Target Grade
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className={`w-full p-2.5 rounded-xl border-2 font-bold text-xs transition-colors outline-none ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-100"
                    : "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500"
                }`}
              >
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>1st Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>2nd Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>3rd Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>4th Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>5th Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>6th Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>7th Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>8th Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>9th Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>10th Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>11th Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>12th Grade</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>College / Higher Ed</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={`w-full p-2.5 rounded-xl border-2 font-bold text-xs transition-colors outline-none ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-100"
                    : "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500"
                }`}
              >
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>English</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>Telugu (తెలుగు)</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>Hindi (हिन्दी)</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>Spanish (Español)</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>French (Français)</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>German (Deutsch)</option>
                <option className={isDarkMode ? "bg-slate-800 text-white" : ""}>Japanese (日本語)</option>
              </select>
            </div>
          </div>
          
          <div className="mb-2">
            <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">
              Teacher Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  handleTeacherTypeChange("female");
                  setTeacherVoice("Aoede");
                }}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 ${
                  gender === "female"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-500"
                    : isDarkMode
                    ? "border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>👩</span>
                <span>Ma'm</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleTeacherTypeChange("male");
                  setTeacherVoice("Puck");
                }}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 ${
                  gender === "male"
                    ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-500"
                    : isDarkMode
                    ? "border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>👨</span>
                <span>Sir</span>
              </button>
            </div>
          </div>

          {/* Conditional Input Rendering based on optionsTab */}
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            {optionsTab === "tutor" ? (
              <>
                                {/* 1. LESSON TUTOR FLOW */}
                {/* Progress Dashboard */}
                <div className={`p-3 rounded-xl border-2 mb-2 ${isDarkMode ? "bg-indigo-900/20 border-indigo-500/30" : "bg-indigo-50 border-indigo-200"}`}>
                  <h3 className={`text-xs font-bold mb-2 flex items-center gap-1 ${isDarkMode ? "text-indigo-300" : "text-indigo-700"}`}>
                    <Activity className="w-3.5 h-3.5" /> Session Progress
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className={`text-[10px] uppercase font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Active Time</span>
                      <span className={`text-sm font-black ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                        {Math.floor(activeLearningTime / 60)}m {activeLearningTime % 60}s
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-[10px] uppercase font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Doubts Resolved</span>
                      <span className={`text-sm font-black ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                        {doubtsResolved}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">
                    Core Topic / Lesson Focus
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mitochondria, Ecosystems, Fractions..."
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    className={`w-full p-3 rounded-xl border-2 text-xs font-semibold focus:border-indigo-500 outline-none transition-colors ${
                      isDarkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                        : "bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-600 focus:bg-white"
                    }`}
                  />
                  
                  {/* Inline Suggested Demos */}
                  <div className="flex flex-wrap gap-1 mt-2 items-center">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">💡 Demo:</span>
                    <button
                      onClick={() => loadQuickDemo("Photosynthesis Process")}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${
                        isDarkMode
                          ? "bg-amber-950/30 hover:bg-amber-900/50 text-amber-300 border border-amber-900/40"
                          : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                      }`}
                    >
                      🌿 Photosynthesis
                    </button>
                    <button
                      onClick={() => loadQuickDemo("Newton's 3 Laws of Motion")}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${
                        isDarkMode
                          ? "bg-blue-950/30 hover:bg-blue-900/50 text-blue-300 border border-blue-900/40"
                          : "bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      🏎️ Newton's Laws
                    </button>
                    <button
                      onClick={() => loadQuickDemo("Ancient Egyptian Pyramids")}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${
                        isDarkMode
                          ? "bg-purple-950/30 hover:bg-purple-900/50 text-purple-300 border border-purple-900/40"
                          : "bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200"
                      }`}
                    >
                      🇪🇬 Pyramids (ES)
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                      Study Materials & Input
                    </label>
                    <button
                      onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                      disabled={transcriptionLoading}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                        isRecordingAudio
                          ? "bg-red-500 text-white animate-pulse"
                          : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
                      }`}
                      title="Speak to dictate your study guide text directly"
                    >
                      {transcriptionLoading ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-white/70" />
                          <span>Transcribing...</span>
                        </>
                      ) : isRecordingAudio ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          <span>Stop (Dictating)</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3" />
                          <span>Dictate (Mic)</span>
                        </>
                      )}
                    </button>
                  </div>

                  <textarea
                    placeholder="Paste reference text, study guides, articles, or dictations will appear here..."
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={5}
                    className={`w-full p-3 rounded-xl border-2 text-xs font-medium focus:border-indigo-500 outline-none resize-none mb-3 transition-colors ${
                      isDarkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                        : "bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-600 focus:bg-white"
                    }`}
                  />
                </div>

                {/* YouTube Link Field */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                    YouTube Reference Link
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400">
                      <Video className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Paste educational YouTube URL..."
                      value={youtubeUrl}
                      onChange={(e) => {
                        setYoutubeUrl(e.target.value);
                        if (videoAnalysisResult) setVideoAnalysisResult(null);
                      }}
                      className={`w-full pl-9 pr-3 py-2 rounded-xl border-2 text-xs font-medium focus:border-indigo-500 outline-none transition-colors ${
                        isDarkMode
                          ? "bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                          : "bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-600 focus:bg-white"
                      }`}
                    />
                  </div>
                </div>

                {/* Website URL Field */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                    Website URL
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400">
                      <Globe className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Paste Website URL..."
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2 rounded-xl border-2 text-xs font-medium focus:border-indigo-500 outline-none transition-colors ${
                        isDarkMode
                          ? "bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                          : "bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-600 focus:bg-white"
                      }`}
                    />
                  </div>
                </div>

                {/* Audio File Field */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                    Upload Audio File
                  </span>
                  <div className="relative">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === "string") {
                              const base64 = reader.result.split(",")[1];
                              setAudioFile({
                                name: file.name,
                                content: base64,
                                type: file.type
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      title="Upload audio file"
                    />
                    <div className={`w-full px-3 py-2 rounded-xl border-2 text-xs font-medium flex items-center justify-between transition-colors ${
                      isDarkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Headphones className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className={`truncate ${audioFile ? "text-slate-700 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}>
                          {audioFile ? audioFile.name : "Upload audio files..."}
                        </span>
                      </div>
                      {audioFile && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setAudioFile(null);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full z-20 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drag & Drop File Selector */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    isDragging
                      ? "border-indigo-500 bg-indigo-50/50"
                      : uploadedFile
                      ? isDarkMode ? "border-emerald-500 bg-emerald-950/20" : "border-emerald-500 bg-emerald-50/50"
                      : isDarkMode ? "border-slate-700 bg-slate-800/40 hover:bg-slate-800" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*,video/*,text/plain,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 ${uploadedFile ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-500"}`}>
                    <Upload className="w-4 h-4" />
                  </div>
                  {uploadedFile ? (
                    <div>
                      <p className={`text-[11px] font-bold truncate max-w-[240px] ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
                        ✓ {uploadedFile.name}
                      </p>
                      <p className="text-[9px] text-emerald-500">Successfully attached</p>
                    </div>
                  ) : (
                    <div>
                      <p className={`text-[11px] font-extrabold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                        Upload Photos, Videos, or PDFs
                      </p>
                      <p className={`text-[9px] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                        Or drag and drop study document here
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* 2. HOMEWORK ASSIST FLOW */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                      Homework Problem Details
                    </label>
                    <button
                      onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                      disabled={transcriptionLoading}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                        isRecordingAudio
                          ? "bg-red-500 text-white animate-pulse"
                          : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
                      }`}
                      title="Dictate your homework details directly"
                    >
                      {transcriptionLoading ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-white/70" />
                          <span>Transcribing...</span>
                        </>
                      ) : isRecordingAudio ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          <span>Stop (Dictating)</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3" />
                          <span>Dictate (Mic)</span>
                        </>
                      )}
                    </button>
                  </div>

                  <textarea
                    placeholder="Describe your homework question, math equation, or assign details. AI tutor will make an animated class for it!"
                    value={homeworkText}
                    onChange={(e) => setHomeworkText(e.target.value)}
                    rows={5}
                    className={`w-full p-3 rounded-xl border-2 text-xs font-medium focus:border-indigo-500 outline-none resize-none mb-3 transition-colors ${
                      isDarkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                        : "bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-600 focus:bg-white"
                    }`}
                  />
                </div>

                {/* Upload Homework Image / Diagram / PDF */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                    Upload Homework Image, Photo or PDF
                  </span>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === "string") {
                              const base64 = reader.result.split(",")[1];
                              setHomeworkFile({
                                name: file.name,
                                base64: base64,
                                type: file.type
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      title="Upload homework document"
                    />
                    <div className={`w-full px-3 py-2.5 rounded-xl border-2 text-xs font-medium flex items-center justify-between transition-colors ${
                      isDarkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Upload className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className={`truncate ${homeworkFile ? "text-slate-700 dark:text-slate-100" : "text-gray-400 dark:text-slate-500"}`}>
                          {homeworkFile ? homeworkFile.name : "📷 Upload assignment photo..."}
                        </span>
                      </div>
                      {homeworkFile && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setHomeworkFile(null);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full z-20 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upload Audio Note Explanation */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                    Upload Homework Audio Note
                  </span>
                  <div className="relative">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === "string") {
                              const base64 = reader.result.split(",")[1];
                              setHomeworkAudioFile({
                                name: file.name,
                                base64: base64,
                                type: file.type
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      title="Upload homework explanation audio"
                    />
                    <div className={`w-full px-3 py-2.5 rounded-xl border-2 text-xs font-medium flex items-center justify-between transition-colors ${
                      isDarkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Headphones className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className={`truncate ${homeworkAudioFile ? "text-slate-700 dark:text-slate-100" : "text-gray-400 dark:text-slate-500"}`}>
                          {homeworkAudioFile ? homeworkAudioFile.name : "🎵 Upload assignment audio..."}
                        </span>
                      </div>
                      {homeworkAudioFile && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setHomeworkAudioFile(null);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full z-20 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nice Kid Friendly info note */}
                <div className={`p-3 rounded-xl border flex items-start gap-2 mb-3 ${
                  isDarkMode ? "bg-indigo-950/20 border-indigo-900 text-indigo-300" : "bg-indigo-50 border-indigo-100 text-indigo-800"
                }`}>
                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5 animate-pulse" />
                  <p className="text-[10px] leading-relaxed font-semibold">
                    ClassroomLM will focus specifically on solving and explaining your homework problem step-by-step using interactive graphics, story analogies, and custom-tailored assessments!
                  </p>
                </div>

                {/* Floating Chat Pointer Note */}
                <div className={`mb-3 p-3 rounded-2xl border-2 border-dashed transition-all ${
                  isDarkMode ? "bg-slate-900/40 border-indigo-500/40" : "bg-indigo-50/50 border-indigo-400/40"
                }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                    </span>
                    <span className="text-[11px] font-bold text-indigo-500">Live Homework Coach Ready</span>
                  </div>
                  <p className="text-[10px] leading-relaxed font-medium text-slate-500 dark:text-slate-400 mb-3">
                    Your Homework Coach has moved! Click the floating chat bubble on the <strong className="text-indigo-500">bottom-right</strong> to ask questions, transcribe voice recordings, or upload images and video material.
                  </p>
                  <button
                    onClick={() => {
                      setIsHomeworkChatOpen(true);
                      setIsMagicCameraOpen(true);
                    }}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(34,211,238,0.3)] transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Open Magic Camera</span>
                  </button>
                </div>

                {/* AI Visual & Image Studio accordion card - Swapped to Homework Assist */}
                <div className={`rounded-xl border-2 overflow-hidden transition-colors mb-3 ${
                  isDarkMode ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-200"
                }`}>
                  <div className={`p-3 flex items-center justify-between border-b ${
                    isDarkMode ? "border-slate-700" : "border-slate-200"
                  }`}>
                    <div className="flex items-center gap-1.5 text-indigo-500">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-wider">AI Visual Study Studio</span>
                    </div>
                    <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Imagen & Vision</span>
                  </div>
                  
                  <div className="p-3 flex flex-col gap-3">
                    {/* 1. Imagen text-to-image generator */}
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wide ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                        🎨 Generate Study Diagram / Image
                      </span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="e.g. structure of animal cell"
                          value={imagePrompt}
                          onChange={(e) => setImagePrompt(e.target.value)}
                          className={`flex-1 p-2 rounded-lg border text-[11px] font-semibold outline-none focus:border-indigo-500 ${
                            isDarkMode ? "bg-slate-900 border-slate-750 text-slate-100 placeholder:text-slate-500" : "bg-slate-100 border-slate-300 text-slate-800 placeholder:text-slate-600 focus:bg-white"
                          }`}
                        />
                        <button
                          onClick={handleGenerateImage}
                          disabled={isGeneratingImage || !imagePrompt.trim()}
                          className="px-3 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center shrink-0"
                        >
                          {isGeneratingImage ? <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-200" /> : "Draw"}
                        </button>
                      </div>

                      {generatedImageUrl && (
                        <div className="relative mt-2 rounded-lg overflow-hidden border-2 border-indigo-400 flex flex-col bg-slate-900">
                          <img
                            src={generatedImageUrl}
                            alt="Generated educational illustration"
                            referrerPolicy="no-referrer"
                            className="w-full h-auto object-cover max-h-48"
                          />
                          <div className="flex p-1 bg-slate-950 gap-1 shrink-0 border-t border-slate-800">
                            <button
                              onClick={() => setIsFullscreenImage(true)}
                              className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold cursor-pointer transition-colors"
                              title="View Fullscreen"
                            >
                              <Maximize className="w-2.5 h-2.5" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => handleDownloadImage(generatedImageUrl, "study-diagram.jpg")}
                              className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-[9px] font-bold cursor-pointer transition-colors"
                              title="Download Image"
                            >
                              <Download className="w-2.5 h-2.5" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => {
                                setLesson((prev) => {
                                  if (!prev) return prev;
                                  const newTimeline = [...prev.timeline];
                                  newTimeline[currentStepIndex] = {
                                    ...newTimeline[currentStepIndex],
                                    whiteboardContent: {
                                      ...newTimeline[currentStepIndex].whiteboardContent,
                                      drawCommands: [
                                        ...(newTimeline[currentStepIndex].whiteboardContent.drawCommands || []),
                                        { type: "text", x: 100, y: 100, text: `[Visual Reference]: ${imagePrompt}`, color: "#4f46e5", size: 14 }
                                      ]
                                    }
                                  };
                                  return { ...prev, timeline: newTimeline };
                                });
                              }}
                              className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold cursor-pointer transition-colors"
                              title="Render this visual onto the chalkboard"
                            >
                              Pin to Board
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={`h-[1px] my-1 ${isDarkMode ? "bg-slate-750" : "bg-slate-200"}`} />

                    {/* 2. Upload study photo and analyze */}
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wide ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                        🔍 Analyse Diagram or homework photo
                      </span>
                      
                      <div className="flex flex-col gap-1.5">
                        <input
                          type="file"
                          accept="image/*"
                          id="study-image-upload"
                          className="hidden"
                          onChange={handleStudyImageUpload}
                        />
                        <button
                          onClick={() => document.getElementById("study-image-upload")?.click()}
                          className={`py-2 px-3 border-2 border-dashed rounded-lg text-xs font-bold text-center transition-all ${
                            uploadedStudyImage
                              ? "border-emerald-500 bg-emerald-50/10 text-emerald-500"
                              : isDarkMode
                              ? "border-slate-750 hover:bg-slate-800 text-slate-300"
                              : "border-slate-200 hover:bg-slate-100 text-slate-600"
                          }`}
                        >
                          {uploadedStudyImage ? `✓ Attached: ${uploadedStudyImageName}` : "📷 Upload Homework / Diagram"}
                        </button>

                        {uploadedStudyImage && (
                          <div className="flex flex-col gap-1.5 mt-1">
                            <input
                              type="text"
                              placeholder="Optional custom question..."
                              value={studyImagePrompt}
                              onChange={(e) => setStudyImagePrompt(e.target.value)}
                              className={`p-2 rounded-lg border text-[11px] font-semibold outline-none focus:border-indigo-500 ${
                                isDarkMode ? "bg-slate-900 border-slate-750 text-slate-100 placeholder:text-slate-500" : "bg-slate-100 border-slate-300 text-slate-800 placeholder:text-slate-600 focus:bg-white"
                              }`}
                            />
                            <button
                              onClick={handleAnalyzeStudyImage}
                              disabled={isAnalyzingStudyImage}
                              className="py-1.5 w-full bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              {isAnalyzingStudyImage ? (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-200" />
                                  <span>Analyzing...</span>
                                </>
                              ) : (
                                uploadedStudyImage ? "Send/Clear Doubt" : "Understand Image (Gemini Pro)"
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {studyImageAnalysis && (
                        <div className={`mt-2 p-2.5 rounded-lg border text-[11px] leading-relaxed font-semibold max-h-44 overflow-y-auto ${
                          isDarkMode ? "bg-slate-900 border-slate-750 text-slate-300" : "bg-white border-slate-200 text-slate-700"
                        }`}>
                          <span className="text-[9px] font-extrabold text-emerald-500 block uppercase mb-1">
                            Gemini Vision Analysis
                          </span>
                          <div className="markdown-body text-[11px] leading-relaxed">
                            <Markdown>{studyImageAnalysis}</Markdown>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

              {/* Video Analysis Result Panel */}
              {videoAnalysisResult && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-3.5 mb-3 flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center gap-1.5 text-indigo-800">
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse animate-duration-1000" />
                    <h5 className="text-[11px] font-extrabold uppercase tracking-wide">
                      Video Analysis Summary
                    </h5>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                    {videoAnalysisResult.summary.slice(0, 180)}...
                  </p>
                  
                  {videoAnalysisResult.keyConcepts.length > 0 && (
                    <div className="mt-1">
                      <span className="text-[9px] font-extrabold text-indigo-500 block uppercase">
                        Key Concepts Detected
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {videoAnalysisResult.keyConcepts.slice(0, 3).map((c, i) => (
                          <span
                            key={i}
                            className="bg-indigo-100/70 border border-indigo-200 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-lg"
                          >
                            {c.concept}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}



            {/* Error Message if present */}
            {errorMsg && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-semibold text-red-700 leading-tight">
                  {errorMsg}
                </p>
              </div>
            )}

            {/* Main Action Trigger */}
            <button
              onClick={() => generateNewLesson()}
              disabled={isGenerating}
              className="w-full mt-auto py-3.5 bg-orange-500 text-white rounded-2xl font-black text-base shadow-[0_6px_0_#C2410C] hover:bg-orange-600 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-5 h-5 animate-pulse text-white" />
                  <span>PREPARING CLASSROOM...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 fill-white animate-pulse" />
                  <span>{optionsTab === "homework" ? "CLARIFY DOUBT" : "GENERATE AI LESSON"}</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Right Panel: Virtual Classroom Viewer */}
        <section className={`flex-1 flex flex-col relative overflow-hidden transition-all duration-500 bg-transparent`}>
          {/* Kid-friendly Background Elements & Glowing Rainbow Flame at the bottom */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
            {/* Light Mode Kid Friendly Elements (Clouds, Sun, Aeroplanes, Birds) */}
            {!isDarkMode && (
              <>
                {/* Soft clouds static and animated */}
                <div className="absolute top-12 left-[10%] w-24 h-12 bg-white/80 rounded-full filter blur-[1px] animate-float-slow opacity-80" />
                <div className="absolute top-20 right-[15%] w-32 h-16 bg-white/70 rounded-full filter blur-[1px] animate-float-slow opacity-75" style={{ animationDelay: "-2s" }} />
                
                {/* Home screen exclusive animated clouds */}
                {!lesson && (
                  <>
                    <div className="absolute top-32 left-0 w-28 h-12 text-white/70 animate-cloud-drift">
                      <svg className="w-full h-full fill-current filter drop-shadow-sm" viewBox="0 0 24 24">
                        <path d="M19.36 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.64-4.96z" />
                      </svg>
                    </div>
                    <div className="absolute top-64 left-0 w-36 h-16 text-white/60 animate-cloud-drift-fast" style={{ animationDelay: "-10s" }}>
                      <svg className="w-full h-full fill-current filter drop-shadow-sm" viewBox="0 0 24 24">
                        <path d="M19.36 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.64-4.96z" />
                      </svg>
                    </div>
                  </>
                )}

                {/* Cute smiley Sun element in background */}
                <div className="absolute top-8 right-[5%] w-16 h-16 bg-amber-200/30 rounded-full flex items-center justify-center animate-spin-slow">
                  <div className="w-12 h-12 bg-yellow-300/40 rounded-full relative">
                    <div className="absolute top-4 left-3 w-1.5 h-1.5 bg-yellow-800/50 rounded-full" />
                    <div className="absolute top-4 right-3 w-1.5 h-1.5 bg-yellow-800/50 rounded-full" />
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-2 border-b-2 border-yellow-800/50 rounded-full" />
                  </div>
                </div>

                {/* Home page exclusive aeroplanes and birds */}
                {!lesson && (
                  <>
                    {/* Aeroplane flying right - Beautiful Cartoon Style */}
                    <div className="absolute top-1/4 left-0 animate-fly-right pointer-events-none">
                      <svg className="w-16 h-16 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)]" viewBox="0 0 64 64" fill="none">
                        {/* Propeller Spin Lines */}
                        <path d="M53 14c0 0 2 4 1 8M53 38c0 0 2-4 1-8" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" className="animate-pulse" />
                        {/* Tail Fin */}
                        <path d="M14 21 L6 9c-1.2-1.5 1-3 2.5-1.5l9.5 9c1 .8.5 4-2 4.5z" fill="#EF4444" />
                        <path d="M14 21 L8 11c-.8-1 1-2 2-1l7.5 7c.8.6.4 3-1.5 3.5z" fill="#B91C1C" />
                        {/* Stabilizer (Horizontal tail) */}
                        <path d="M8 23c-1.5 0-2.5-.8-2.5-1.5s1-1.5 2.5-1.5h6c1 0 1.5 1 1.5 1.5s-.5 1.5-1.5 1.5H8z" fill="#B91C1C" />
                        {/* Main Fuselage */}
                        <path d="M12 29c-4 0-7-3-7-6s3-6 7-6h30c7 0 13 2.5 13 6s-6 6-13 6H12z" fill="#3B82F6" />
                        <path d="M12 29c-4 0-7-1.5-7-3s3-3 7-3h30c7 0 13 1 13 3s-6 3-13 3H12z" fill="#1D4ED8" opacity="0.25" />
                        {/* Nose Cone */}
                        <path d="M53 20c2.5 0 4 1.5 4 3s-1.5 3-4 3v-6z" fill="#F59E0B" />
                        {/* Windshield / Front Cabin */}
                        <path d="M41 18c3 0 5 1.5 5 3.5S44 25 41 25h-5c-1.5 0-2-1.5-2-3.5s.5-3.5 2-3.5h5z" fill="#93C5FD" />
                        <path d="M41 18c1.5 0 2.5.8 2.5 1.8S42.5 21.5 41 21.5h-4c-.8 0-1-.8-1-1.8s.2-1.8 1-1.8h4z" fill="#FFFFFF" opacity="0.6" />
                        {/* Cabin Windows */}
                        <circle cx="28" cy="23" r="2.5" fill="#FFFFFF" />
                        <circle cx="28" cy="23" r="1.5" fill="#93C5FD" />
                        <circle cx="20" cy="23" r="2.5" fill="#FFFFFF" />
                        <circle cx="20" cy="23" r="1.5" fill="#93C5FD" />
                        {/* Main Wing (Under / Behind) */}
                        <path d="M29 18c1 0 1.8-.8 1.5-1.8l-1.5-5c-.3-1-1.8-1-2 0l-1.5 5c-.3 1 .5 1.8 3.5 1.8z" fill="#F59E0B" opacity="0.7" />
                        {/* Main Wing (Front / Overlay) */}
                        <path d="M27 25c1.2 0 2.2.8 1.8 2l-4 12.5c-.5 1.5-3 1.5-3.5 0l-1.8-12.5c-.3-1.2.8-2 7.5-2z" fill="#F59E0B" />
                        <path d="M26 25c.8 0 1.5.5 1.2 1.2l-3.5 11c-.3 1-2 1-2.4 0l-1.2-11c-.2-.8.5-1.2 5.9-1.2z" fill="#D97706" />
                        {/* Propeller hub and blades */}
                        <path d="M55 23h4v1h-4zM53.5 16l1 14M55.5 16l-1 14" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>

                    {/* Birds flying left */}
                    <div className="absolute top-1/3 left-0 animate-fly-left pointer-events-none" style={{ animationDelay: "-5s" }}>
                      <svg className="w-8 h-8 text-indigo-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 10s3-3 6-3 6 4 6 4 3-4 6-4 6 3 6 3" />
                      </svg>
                    </div>
                    <div className="absolute top-1/2 left-0 animate-fly-left pointer-events-none" style={{ animationDelay: "-12s" }}>
                      <svg className="w-6 h-6 text-indigo-400/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 10s3-3 6-3 6 4 6 4 3-4 6-4 6 3 6 3" />
                      </svg>
                    </div>

                    {/* Fun, kids-friendly educational stickers with white borders and shadows (no labels below them) */}
                    <div className="absolute top-[45%] right-[10%] animate-float-slow pointer-events-none" style={{ animationDelay: "-3s" }}>
                      <div className="w-14 h-14 bg-emerald-400 border-4 border-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-6">
                        <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24">
                          <path d="M12 21c-1.2-1.22-3.48-1.5-6-1.5H3V5c1.8 0 3.3.3 4.5 1.5C8.7 7.7 10.2 8 12 8c1.8 0 3.3-.3 4.5-1.5 1.2-1.2 2.7-1.5 4.5-1.5v14.5c-2.52 0-4.8.28-6 1.5z" />
                        </svg>
                      </div>
                    </div>

                    <div className="absolute top-16 left-[22%] animate-float-slow pointer-events-none" style={{ animationDelay: "-1.5s" }}>
                      <div className="w-14 h-14 bg-indigo-500 border-4 border-white rounded-full flex items-center justify-center shadow-lg transform -rotate-12">
                        <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24">
                          <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                          <path d="M5 13.18v4c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-4l-7 3.82-7-3.82z" />
                        </svg>
                      </div>
                    </div>

                    <div className="absolute bottom-[28%] left-[8%] animate-float-slow pointer-events-none" style={{ animationDelay: "-4.5s" }}>
                      <div className="w-14 h-14 bg-amber-400 border-4 border-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-12">
                        <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24">
                          <path d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 16H7v-2h8v2zm0-4H7v-2h8v2zm0-4H7V9h8v2zm0-4H7V5h8v2z" />
                        </svg>
                      </div>
                    </div>

                    <div className="absolute bottom-[40%] right-[24%] animate-float-slow pointer-events-none" style={{ animationDelay: "-2.5s" }}>
                      <div className="w-14 h-14 bg-cyan-400 border-4 border-white rounded-full flex items-center justify-center shadow-lg transform -rotate-6">
                        <svg className="w-8 h-8 text-white fill-none stroke-current" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                          <path d="M2 12h20" />
                        </svg>
                      </div>
                    </div>

                    <div className="absolute top-1/3 left-[28%] animate-float-slow pointer-events-none" style={{ animationDelay: "-6s" }}>
                      <div className="w-14 h-14 bg-yellow-400 border-4 border-white rounded-full flex items-center justify-center shadow-lg transform rotate-6">
                        <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24">
                          <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-1.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z" />
                        </svg>
                      </div>
                    </div>

                    <div className="absolute top-[60%] left-[16%] animate-float-slow pointer-events-none" style={{ animationDelay: "-0.5s" }}>
                      <div className="w-14 h-14 bg-pink-400 border-4 border-white rounded-full flex items-center justify-center shadow-lg transform -rotate-12">
                        <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Dark Mode Kid Friendly Elements (Moon, Sparkles, Rockets, Planets) */}
            {isDarkMode && (
              <>
                {/* Sleepy Moon */}
                <div className="absolute top-10 right-[8%] w-16 h-16 bg-indigo-950/40 rounded-full flex items-center justify-center animate-float-slow">
                  <div className="w-12 h-12 bg-yellow-100/10 rounded-full relative">
                    <div className="absolute top-3 left-3 w-1 h-1 bg-yellow-200/30 rounded-full animate-ping" />
                    <div className="absolute inset-0 rounded-full border-r-4 border-b-4 border-yellow-200/20" />
                  </div>
                </div>
                {/* Tiny glowing stars */}
                <div className="absolute top-24 left-[12%] w-2 h-2 bg-yellow-200/40 rounded-full animate-pulse" />
                <div className="absolute top-40 left-[20%] w-3 h-3 bg-purple-300/30 rounded-full animate-ping" style={{ animationDuration: "3s" }} />
                <div className="absolute top-16 right-[30%] w-1.5 h-1.5 bg-cyan-200/50 rounded-full animate-pulse" style={{ animationDelay: "1s" }} />
                <div className="absolute top-48 right-[12%] w-2 h-2 bg-pink-300/40 rounded-full animate-pulse" style={{ animationDelay: "2s" }} />

                {/* Home page exclusive rockets and planets */}
                {!lesson && (
                  <>
                    {/* Saturn Planet gently floating */}
                    <div className="absolute top-1/4 left-[15%] animate-float-planet pointer-events-none">
                      <div className="flex flex-col items-center">
                        <svg className="w-16 h-16 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1.5 13.5c2-1 6-2 10.5-2s8.5 1 10.5 2" />
                          <circle cx="12" cy="12" r="5.5" fill="currentColor" className="text-slate-900/95" />
                          <path d="M1.5 13.5c1 1.5 5 3.5 10.5 3.5s9.5-2 10.5-3.5" />
                        </svg>
                      </div>
                    </div>

                    {/* Mars style floating planet */}
                    <div className="absolute bottom-1/3 right-[18%] animate-float-planet pointer-events-none" style={{ animationDelay: "-3s" }}>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-red-500 relative shadow-inner flex items-center justify-center border border-red-400/25">
                        <div className="w-2 h-2 rounded-full bg-red-800/40 absolute top-2 left-3" />
                        <div className="w-1.5 h-1.5 rounded-full bg-red-800/40 absolute bottom-3 right-2" />
                      </div>
                    </div>

                    {/* Rocket blasting off */}
                    <div className="absolute bottom-12 left-6 animate-rocket-blast pointer-events-none">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-orange-500 fill-current filter drop-shadow-[0_4px_12px_rgba(249,115,22,0.5)]" viewBox="0 0 24 24">
                          <path d="M12 2C7.5 2 4 5 4 11l.5 4.5L9 17l1.5.5H13c6 0 9-3.5 9-8s-1.5-7.5-10-7.5z" />
                          <path d="M4.5 16.5c-1.5 1.26-2 3.38-2 3.38s2.12-.5 3.38-2" className="text-red-500" />
                          <circle cx="15" cy="9" r="1.5" className="text-slate-950" />
                        </svg>
                        <div className="w-2 h-6 bg-gradient-to-b from-orange-500 to-transparent rounded-full animate-pulse -mt-1" />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Standalone, high-performance Gemini Live Liquid Wave spanning the entire bottom of the screen */}
            <GeminiLiveWave isDarkMode={isDarkMode} />
          </div>
          
          {/* Scrollable Content Container */}
          <div className={`absolute inset-0 z-10 p-6 flex flex-col ${
            !lesson ? "overflow-hidden" : "overflow-y-auto"
          }`}>
          
          {lesson ? (
            <div className="flex-1 flex flex-col justify-between max-w-4xl mx-auto w-full gap-4 z-10 relative">
              
              {/* Lesson General Info */}
              <div className={`transition-colors duration-300 border-3 p-4 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isDarkMode ? "bg-slate-900/90 backdrop-blur border-yellow-600 text-slate-100" : "bg-white/90 backdrop-blur border-yellow-400 text-slate-800"
              }`}>
                <div className="flex-1">
                  <h3 className={`text-lg font-black flex items-center gap-2 transition-colors ${
                    isDarkMode ? "text-slate-100" : "text-slate-800"
                  }`}>
                    <BookOpen className="w-5 h-5 text-indigo-500" />
                    {lesson.title}
                  </h3>
                  <p className={`text-xs font-medium font-sans transition-colors ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}>
                    {lesson.description}
                  </p>
                </div>
                
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Download PDF button */}
                  <button
                    onClick={downloadLessonSummaryPDF}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-emerald-500/20"
                    title="Download complete lesson summary & quiz as a clean printable PDF report"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF Summary</span>
                  </button>

                  {/* Mode Selector */}
                  <div className={`flex rounded-xl p-1 border-2 transition-colors ${
                    isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200"
                  }`}>
                    <button
                      onClick={() => {
                        setActiveTab("lesson");
                        setIsFlashcardFlipped(false);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        activeTab === "lesson"
                          ? "bg-indigo-600 text-white shadow"
                          : isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Interactive Class
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("flashcards");
                        setIsFlashcardFlipped(false);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        activeTab === "flashcards"
                          ? "bg-indigo-600 text-white shadow"
                          : isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Flashcards
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("quiz");
                        setIsFlashcardFlipped(false);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        activeTab === "quiz"
                          ? "bg-indigo-600 text-white shadow"
                          : isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Lesson Quiz
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Tab Render Panel */}
              <div className="flex-1 flex flex-col justify-center py-2">
                {activeTab === "lesson" ? (
                  <div className="flex-1 flex flex-col gap-4 h-full">
                    {!hasLectureStarted ? (
                      /* Success Notification & Custom Start Player Card */
                      <div className={`p-6 rounded-3xl border-3 shadow-xl transition-all duration-300 ${
                        isDarkMode 
                          ? "bg-slate-900/95 border-indigo-600 text-slate-100" 
                          : "bg-white border-yellow-400 text-slate-800"
                      }`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="bg-emerald-100 dark:bg-emerald-950 p-2.5 rounded-2xl text-emerald-600 dark:text-emerald-400 animate-bounce">
                            <Sparkles className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-black tracking-tight">
                              ✨ AI Lecture Created Successfully!
                            </h3>
                            <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                              Your study materials have been transformed into a fully interactive animated lesson.
                            </p>
                          </div>
                        </div>

                        <p className={`text-xs font-semibold leading-relaxed mb-6 font-sans ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                          The virtual AI Teacher has prepared a <strong>{lesson.timeline.length}-part personalized curriculum</strong> with visual whiteboards, interactive gestures, translations, and a final assessment quiz tailored for you.
                        </p>

                        {/* Player below the text */}
                        <div className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row items-center justify-between gap-4 ${
                          isDarkMode ? "bg-slate-850 border-slate-700" : "bg-slate-50 border-slate-200"
                        }`}>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setHasLectureStarted(true);
                                setIsPlaying(true);
                              }}
                              className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0"
                              title="Click to start the AI lecture"
                            >
                              <Play className="w-5 h-5 fill-white ml-0.5" />
                            </button>
                            <div className="text-left">
                              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-500">
                                Start AI Lecture
                              </h4>
                              <p className={`text-[11px] font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                Click player button to launch voice tutoring and whiteboard guide
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-1 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded-lg">
                              {lesson.timeline.length} Parts
                            </span>
                            <span className="text-[10px] font-bold px-2 py-1 bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300 rounded-lg">
                              Quiz Ready
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <ClassroomScene
                        isRateLimited={isRateLimited}
                        remainingSeconds={remainingSeconds}
                        trackRequest={trackRequest}
                                                currentStep={lesson.timeline[currentStepIndex]}
                        timeline={lesson.timeline}
                        isPlaying={isPlaying}
                        onPauseToggle={() => setIsPlaying(!isPlaying)}
                        onStepChange={(index) => {
                          setCurrentStepIndex(index);
                          setInterruptedDoubt(null);
                          setIsPlaying(false);
                        }}
                        currentStepIndex={currentStepIndex}
                        totalSteps={lesson.timeline.length}
                        interruptedDoubt={interruptedDoubt}
                        onResolveInterruption={resolveDoubtAndResume}
                        language={language}
                        onDialogueComplete={handleStepComplete}
                        isDarkMode={isDarkMode}
                        isListening={isListening}
                        toggleListening={toggleListening}
                        isWaitingForUserVoice={isWaitingForUserVoice}
                        onDoubtPromptComplete={handleDoubtPromptComplete}
                        isResolvingDoubt={isResolvingDoubt}
                        doubtText={doubtText}
                        setDoubtText={setDoubtText}
                        submitDoubt={submitDoubt}
                        avatarSkinColor={avatarSkinColor}
                        avatarOutfitColor={avatarOutfitColor}
                        avatarHairColor={avatarHairColor}
                        avatarHairStyle={avatarHairStyle}
                        avatarGlassesColor={avatarGlassesColor}
                        gender={gender}
                        teacherVoice={teacherVoice}
                        onVoiceChange={setTeacherVoice}
                        onFullscreenChange={(fullscreen) => setIsClassroomFullscreen(fullscreen)}
                      />
                    )}

                    {/* CUSTOMIZE TEACHER AVATAR PANEL */}
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => setIsCustomizingAvatar(!isCustomizingAvatar)}
                        className={`w-full py-2 px-4 rounded-xl text-xs font-extrabold uppercase tracking-widest border-2 flex items-center justify-center gap-2 transition-all ${
                          isCustomizingAvatar
                            ? "bg-indigo-600 border-indigo-700 text-white shadow-lg"
                            : isDarkMode
                            ? "bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span>🎨 {isCustomizingAvatar ? "Close Avatar Customizer" : "Customize Teacher Avatar"}</span>
                      </button>

                      {isCustomizingAvatar && (
                        <div
                          className={`rounded-2xl border-2 p-5 shadow-inner overflow-hidden flex flex-col gap-4 transition-colors ${
                            isDarkMode ? "bg-slate-900/90 border-slate-800 text-slate-200" : "bg-slate-50/90 border-slate-200 text-slate-800"
                          }`}
                        >
                          <h4 className="text-xs font-black uppercase tracking-wider text-indigo-500">
                            Teacher Wardrobe & Appearance Customizer
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Skin Color */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                                Skin Tone
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "Fair", color: "#fed7aa" },
                                  { name: "Tan", color: "#f59e0b" },
                                  { name: "Rich", color: "#854d0e" },
                                  { name: "Emerald", color: "#10b981" },
                                  { name: "Amethyst", color: "#a855f7" }
                                ].map((skin) => (
                                  <button
                                    key={skin.color}
                                    onClick={() => setAvatarSkinColor(skin.color)}
                                    className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                                      avatarSkinColor === skin.color ? "border-indigo-500 ring-2 ring-indigo-400/50 scale-105" : "border-slate-300"
                                    }`}
                                    style={{ backgroundColor: skin.color }}
                                    title={skin.name}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Blazer Outfit Color */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                                Outfit (Blazer)
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "Indigo", color: "#4f46e5" },
                                  { name: "Crimson", color: "#ef4444" },
                                  { name: "Emerald", color: "#10b981" },
                                  { name: "Gold", color: "#f59e0b" },
                                  { name: "Charcoal", color: "#1e293b" }
                                ].map((outfit) => (
                                  <button
                                    key={outfit.color}
                                    onClick={() => setAvatarOutfitColor(outfit.color)}
                                    className={`w-6 h-6 rounded-md border-2 transition-all hover:scale-110 ${
                                      avatarOutfitColor === outfit.color ? "border-indigo-500 ring-2 ring-indigo-400/50 scale-105" : "border-slate-300"
                                    }`}
                                    style={{ backgroundColor: outfit.color }}
                                    title={outfit.name}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Hair Style */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                                Hair Style
                              </label>
                              <select
                                value={avatarHairStyle}
                                onChange={(e) => setAvatarHairStyle(e.target.value)}
                                className={`text-xs p-1.5 rounded-lg border outline-none font-medium cursor-pointer ${
                                  isDarkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                                }`}
                              >
                                <option value="normal">Normal Full Hair</option>
                                <option value="smart">Bangs Haircut</option>
                                <option value="bun">Top Bun</option>
                                <option value="spiky">Spiky Crop</option>
                                <option value="professor">Receding Professor</option>
                              </select>
                            </div>

                            {/* Hair Color */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                                Hair Color
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "Chestnut", color: "#78350f" },
                                  { name: "Velvet", color: "#1e1b18" },
                                  { name: "Blonde", color: "#fbbf24" },
                                  { name: "Crimson", color: "#ef4444" },
                                  { name: "Amethyst", color: "#a855f7" }
                                ].map((hair) => (
                                  <button
                                    key={hair.color}
                                    onClick={() => setAvatarHairColor(hair.color)}
                                    className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                                      avatarHairColor === hair.color ? "border-indigo-500 ring-2 ring-indigo-400/50 scale-105" : "border-slate-300"
                                    }`}
                                    style={{ backgroundColor: hair.color }}
                                    title={hair.name}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Glasses / Specs */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                                Glasses Color
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "Crimson", color: "#ef4444" },
                                  { name: "Ocean", color: "#3b82f6" },
                                  { name: "Onyx", color: "#1e1b18" },
                                  { name: "Gold", color: "#fbbf24" },
                                  { name: "None", color: "none" }
                                ].map((glasses) => (
                                  <button
                                    key={glasses.color}
                                    onClick={() => setAvatarGlassesColor(glasses.color)}
                                    className={`w-6 h-6 rounded-md border-2 transition-all hover:scale-110 flex items-center justify-center ${
                                      avatarGlassesColor === glasses.color ? "border-indigo-500 ring-2 ring-indigo-400/50 scale-105" : "border-slate-300"
                                    }`}
                                    style={{ backgroundColor: glasses.color === "none" ? "transparent" : glasses.color }}
                                    title={glasses.name}
                                  >
                                    {glasses.color === "none" && <span className="text-[10px] text-slate-400">✖</span>}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Teacher Type */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                                Teacher Type
                              </label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleTeacherTypeChange("female")}
                                  className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg border-2 transition-all flex items-center justify-center gap-1.5 ${
                                    gender === "female"
                                      ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-400"
                                      : isDarkMode
                                      ? "border-slate-800 bg-slate-800/50 text-slate-400 hover:bg-slate-700"
                                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  <span>👩</span>
                                  <span>Ma'm</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTeacherTypeChange("male")}
                                  className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg border-2 transition-all flex items-center justify-center gap-1.5 ${
                                    gender === "male"
                                      ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-400"
                                      : isDarkMode
                                      ? "border-slate-800 bg-slate-800/50 text-slate-400 hover:bg-slate-700"
                                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  <span>👨</span>
                                  <span>Sir</span>
                                </button>
                              </div>
                            </div>

                            {/* Voice Option */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                                Voice Option
                              </label>
                              <select
                                value={teacherVoice}
                                onChange={(e) => setTeacherVoice(e.target.value)}
                                className={`text-xs p-1.5 rounded-lg border outline-none font-medium cursor-pointer ${
                                  isDarkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                                }`}
                              >
                                {gender === "female" ? (
                                  <>
                                    <option value="Aoede">Aoede (Ma'm: Professional & Informative)</option>
                                    <option value="Kore">Kore (Ma'm: Enthusiastic & Bold)</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="Charon">Charon (Sir: Deep & Informative)</option>
                                    <option value="Fenrir">Fenrir (Sir: Energetic & Enthusiastic)</option>
                                    <option value="Puck">Puck (Sir: Bold & Playful)</option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Interactive Audio Transcription Log for Teacher's Audio */}
                    <div className={`rounded-2xl border-2 p-4 shadow-md transition-colors duration-300 ${
                      isDarkMode ? "bg-slate-900/90 backdrop-blur border-yellow-600 text-slate-100" : "bg-white/90 backdrop-blur border-yellow-400 text-slate-800"
                    }`}>
                      <div className={`flex items-center justify-between mb-3 border-b pb-2 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                        <div className="flex items-center gap-2">
                          <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600">
                            <Mic className="w-4 h-4 animate-pulse" />
                          </div>
                          <div>
                            <h4 className={`text-xs font-black uppercase tracking-wide transition-colors ${
                              isDarkMode ? "text-slate-100" : "text-slate-800"
                            }`}>
                              Live Classroom Audio Transcription Log
                            </h4>
                            <p className={`text-[10px] font-bold transition-colors ${
                              isDarkMode ? "text-slate-400" : "text-slate-500"
                            }`}>
                              Read verbatim speech script. Click any block to jump directly to that part of the lesson.
                            </p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                          isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                        }`}>
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                          <span>Streaming Transcription</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                        {lesson.timeline.map((step, idx) => {
                          const isActive = idx === currentStepIndex && !interruptedDoubt;
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                setCurrentStepIndex(idx);
                                setInterruptedDoubt(null);
                              }}
                              className={`w-full text-left p-2.5 rounded-xl transition-all border-2 text-xs flex items-start gap-3 cursor-pointer group relative ${
                                isActive
                                  ? isDarkMode
                                    ? "bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-950"
                                    : "bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-100"
                                  : isDarkMode
                                    ? "bg-slate-800/40 border-slate-800 hover:border-slate-700 text-slate-300"
                                    : "bg-slate-50/70 border-slate-100 hover:border-slate-200 text-slate-600"
                              }`}
                            >
                              <div className={`mt-0.5 px-2 py-0.5 rounded text-[9px] font-black tracking-wider shrink-0 uppercase ${
                                isActive
                                  ? "bg-indigo-600 text-white"
                                  : isDarkMode
                                    ? "bg-slate-700 text-slate-300"
                                    : "bg-slate-200 text-slate-600"
                              }`}>
                                {step.timestamp || `Part ${idx + 1}`}
                              </div>
                              <div className="flex-1">
                                <p className={`font-semibold transition-colors ${
                                  isActive
                                    ? isDarkMode ? "text-white font-bold" : "text-slate-900 font-bold"
                                    : isDarkMode ? "text-slate-300" : "text-slate-600"
                                }`}>
                                  {step.spokenDialogue}
                                </p>
                                {step.translationText && step.translationText !== step.spokenDialogue && (
                                  <p className={`text-[10px] italic mt-0.5 font-bold transition-colors ${
                                    isDarkMode ? "text-indigo-400" : "text-slate-400"
                                  }`}>
                                    Translate: {step.translationText}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isActive && (
                                  <span className="text-indigo-400 text-[10px] font-black animate-pulse uppercase tracking-wider">
                                    ● Speaking
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(step.spokenDialogue);
                                    setCopiedStepIndex(idx);
                                    setTimeout(() => setCopiedStepIndex(null), 2000);
                                  }}
                                  className={`p-1 rounded-md transition-colors ${
                                    isDarkMode
                                      ? "hover:bg-slate-700 text-slate-400 hover:text-white"
                                      : "hover:bg-slate-200 text-slate-200 hover:text-slate-900"
                                  }`}
                                  title="Copy text to clipboard"
                                  id={`copy-transcript-step-${idx}`}
                                >
                                  {copiedStepIndex === idx ? (
                                    <Check className="w-3.5 h-3.5 text-green-500 animate-bounce" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : activeTab === "flashcards" ? (
                  <div className={`flex flex-col lg:flex-row gap-5 items-stretch w-full ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
                    
                    {/* Sidebar / Left side: Classroom Scene so the virtual teacher is still in view */}
                    <div className="flex-1 lg:max-w-md w-full shrink-0">
                      <ClassroomScene
                        isRateLimited={isRateLimited}
                        remainingSeconds={remainingSeconds}
                        trackRequest={trackRequest}
                                                currentStep={lesson.timeline[currentStepIndex]}
                        timeline={lesson.timeline}
                        isPlaying={isPlaying}
                        onPauseToggle={() => setIsPlaying(!isPlaying)}
                        onStepChange={(index) => {
                          setCurrentStepIndex(index);
                          setInterruptedDoubt(null);
                          setIsPlaying(false);
                        }}
                        currentStepIndex={currentStepIndex}
                        totalSteps={lesson.timeline.length}
                        interruptedDoubt={interruptedDoubt}
                        onResolveInterruption={resolveDoubtAndResume}
                        language={language}
                        onDialogueComplete={handleStepComplete}
                        isDarkMode={isDarkMode}
                        isListening={isListening}
                        toggleListening={toggleListening}
                        isWaitingForUserVoice={isWaitingForUserVoice}
                        onDoubtPromptComplete={handleDoubtPromptComplete}
                        isResolvingDoubt={isResolvingDoubt}
                        doubtText={doubtText}
                        setDoubtText={setDoubtText}
                        submitDoubt={submitDoubt}
                        avatarSkinColor={avatarSkinColor}
                        avatarOutfitColor={avatarOutfitColor}
                        avatarHairColor={avatarHairColor}
                        avatarHairStyle={avatarHairStyle}
                        avatarGlassesColor={avatarGlassesColor}
                        gender={gender}
                        teacherVoice={teacherVoice}
                        onVoiceChange={setTeacherVoice}
                        onFullscreenChange={(fullscreen) => setIsClassroomFullscreen(fullscreen)}
                      />
                    </div>

                    {/* Flashcard Panel */}
                    <div className={`flex-1 rounded-3xl p-6 shadow-2xl border-4 flex flex-col gap-5 transition-all duration-300 ${
                      isDarkMode ? "bg-slate-900 border-yellow-600 text-slate-100" : "bg-white border-yellow-400 text-slate-850"
                    }`}>
                      
                      {/* Visual header */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between border-b-2 pb-4 gap-3 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                        <div className="flex items-center gap-2">
                          <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-400" />
                          </div>
                          <div>
                            <h4 className={`text-base font-extrabold transition-colors ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
                              Vocabulary & Concepts Flashcards
                            </h4>
                            <p className="text-[11px] font-bold text-slate-400">
                              Active recall cards generated automatically from this lesson.
                            </p>
                          </div>
                        </div>

                        {/* Study Mode Progress Badge */}
                        <div className="text-right flex items-center gap-3 shrink-0">
                          <div className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 text-xs font-bold">
                            Mastered: <span className="text-indigo-500 font-extrabold">{masteredFlashcards.size}</span> / {generateFlashcards(lesson).length}
                          </div>
                        </div>
                      </div>

                      {/* Filter Tabs */}
                      <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-2 flex-wrap">
                        <button
                          onClick={() => {
                            setFlashcardFilter("all");
                            setCurrentFlashcardIndex(0);
                            setIsFlashcardFlipped(false);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                            flashcardFilter === "all"
                              ? "bg-indigo-600 border-indigo-600 text-white shadow"
                              : isDarkMode
                                ? "bg-slate-800/40 border-slate-800 hover:border-slate-700 text-slate-300"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600"
                          }`}
                        >
                          All Cards ({generateFlashcards(lesson).length})
                        </button>
                        <button
                          onClick={() => {
                            setFlashcardFilter("learning");
                            setCurrentFlashcardIndex(0);
                            setIsFlashcardFlipped(false);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                            flashcardFilter === "learning"
                              ? "bg-amber-600 border-amber-600 text-white shadow"
                              : isDarkMode
                                ? "bg-slate-800/40 border-slate-800 hover:border-slate-700 text-slate-300"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600"
                          }`}
                        >
                          Need Practice ({generateFlashcards(lesson).length - masteredFlashcards.size})
                        </button>
                        <button
                          onClick={() => {
                            setFlashcardFilter("mastered");
                            setCurrentFlashcardIndex(0);
                            setIsFlashcardFlipped(false);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                            flashcardFilter === "mastered"
                              ? "bg-emerald-600 border-emerald-600 text-white shadow"
                              : isDarkMode
                                ? "bg-slate-800/40 border-slate-800 hover:border-slate-700 text-slate-300"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600"
                          }`}
                        >
                          Mastered ({masteredFlashcards.size})
                        </button>
                      </div>

                      {(() => {
                        const cards = generateFlashcards(lesson);
                        const filtered = cards.filter(c => {
                          const isMastered = masteredFlashcards.has(c.id);
                          if (flashcardFilter === "mastered") return isMastered;
                          if (flashcardFilter === "learning") return !isMastered;
                          return true;
                        });

                        // Ensure index is valid
                        const safeIdx = currentFlashcardIndex >= filtered.length ? 0 : currentFlashcardIndex;
                        const currentCard = filtered[safeIdx];

                        if (filtered.length === 0) {
                          return (
                            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center gap-4">
                              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center animate-bounce">
                                <CheckCircle2 className="w-8 h-8" />
                              </div>
                              <div>
                                <h5 className="text-sm font-extrabold">All caught up!</h5>
                                <p className="text-xs text-slate-400 max-w-sm mt-1">
                                  {flashcardFilter === "learning"
                                    ? "Fantastic job! You've mastered all the vocabulary cards in this lesson. Ready to ace the assessment?"
                                    : "No cards match this filter. Try checking another category above!"}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  if (flashcardFilter === "learning") {
                                    setMasteredFlashcards(new Set());
                                  }
                                  setFlashcardFilter("all");
                                  setCurrentFlashcardIndex(0);
                                }}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow"
                              >
                                {flashcardFilter === "learning" ? "Reset & Study Again" : "View All Cards"}
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="flex-1 flex flex-col gap-4">
                            {/* Card Display block */}
                            <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
                              <span>CARD {safeIdx + 1} OF {filtered.length}</span>
                              <span className="px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[9px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold border dark:border-indigo-500/20">
                                {currentCard.category}
                              </span>
                            </div>

                            {/* Interactive Flip Card body */}
                            <div
                              onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                              className={`w-full min-h-[240px] p-8 rounded-3xl border-3 transition-all duration-300 transform active:scale-[0.99] cursor-pointer flex flex-col justify-between relative shadow-lg ${
                                isFlashcardFlipped
                                  ? isDarkMode
                                    ? "bg-emerald-950/25 border-emerald-500 text-slate-100 shadow-emerald-950/20"
                                    : "bg-emerald-50/30 border-emerald-400 text-emerald-950 shadow-emerald-100/50"
                                  : isDarkMode
                                    ? "bg-slate-800/40 border-indigo-500 text-slate-100 shadow-indigo-950/20"
                                    : "bg-indigo-50/15 border-indigo-400 text-slate-800 shadow-indigo-100/50"
                              }`}
                            >
                              {/* Flip Hint */}
                              <div className="absolute top-3.5 right-4 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Click to flip</span>
                              </div>

                              <div className="flex-1 flex flex-col justify-center py-4">
                                {!isFlashcardFlipped ? (
                                  <div className="text-center">
                                    <h5 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                                      {currentCard.front}
                                    </h5>
                                    <p className="text-[10px] text-indigo-500/80 dark:text-indigo-400 font-bold uppercase tracking-widest mt-3">
                                      Front Side (Recall)
                                    </p>
                                  </div>
                                ) : (
                                  <div className="text-left font-sans text-xs leading-relaxed font-medium whitespace-pre-wrap">
                                    <div className="border-l-4 border-emerald-500 pl-3">
                                      {currentCard.back}
                                    </div>
                                    <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400 font-bold uppercase tracking-widest mt-4">
                                      Back Side (Explanation)
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Progress bar of current card in filtered list */}
                              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-4">
                                <div
                                  className="bg-indigo-600 h-full transition-all duration-300"
                                  style={{ width: `${((safeIdx + 1) / filtered.length) * 100}%` }}
                                />
                              </div>
                            </div>

                            {/* Deck Navigation and Flip Actions */}
                            <div className="flex items-center justify-between gap-3 mt-1">
                              <button
                                disabled={safeIdx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentFlashcardIndex(prev => Math.max(0, prev - 1));
                                  setIsFlashcardFlipped(false);
                                }}
                                className={`px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all flex items-center gap-1 ${
                                  safeIdx === 0
                                    ? "opacity-40 cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-800"
                                    : isDarkMode
                                      ? "bg-slate-800 border-slate-700 hover:bg-slate-750 text-white cursor-pointer"
                                      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                                }`}
                              >
                                <ChevronLeft className="w-4 h-4" />
                                <span>Previous</span>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsFlashcardFlipped(!isFlashcardFlipped);
                                }}
                                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Flip Card</span>
                              </button>

                              <button
                                disabled={safeIdx === filtered.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentFlashcardIndex(prev => Math.min(filtered.length - 1, prev + 1));
                                  setIsFlashcardFlipped(false);
                                }}
                                className={`px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all flex items-center gap-1 ${
                                  safeIdx === filtered.length - 1
                                    ? "opacity-40 cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-800"
                                    : isDarkMode
                                      ? "bg-slate-800 border-slate-700 hover:bg-slate-750 text-white cursor-pointer"
                                      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                                }`}
                              >
                                <span>Next</span>
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Mastery State Toggles */}
                            <div className="flex gap-3 mt-2 border-t dark:border-slate-800 pt-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newMastered = new Set(masteredFlashcards);
                                  const wasMastered = newMastered.has(currentCard.id);
                                  
                                  if (wasMastered) {
                                    newMastered.delete(currentCard.id);
                                  } else {
                                    newMastered.add(currentCard.id);
                                    // Trigger subtle card auto-advance on mastering
                                    setTimeout(() => {
                                      if (safeIdx < filtered.length - 1) {
                                        setCurrentFlashcardIndex(prev => prev + 1);
                                        setIsFlashcardFlipped(false);
                                      }
                                    }, 400);
                                  }
                                  setMasteredFlashcards(newMastered);
                                }}
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border-2 ${
                                  masteredFlashcards.has(currentCard.id)
                                    ? "bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white shadow"
                                    : isDarkMode
                                      ? "bg-slate-900 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                                      : "bg-white border-emerald-400 text-emerald-600 hover:bg-emerald-50"
                                }`}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>
                                  {masteredFlashcards.has(currentCard.id)
                                    ? "Mastered! (Click to Undo)"
                                    : "Mark as Mastered"}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  /* GAMIFIED QUIZ assessment tab with Classroom Scene displayed side-by-side */
                  <div className="flex flex-col lg:flex-row gap-5 items-stretch w-full">
                    {/* Render the ClassroomScene alongside the quiz so the teacher can clear doubts in real-time! */}
                    <div className="flex-1 lg:max-w-md w-full shrink-0">
                      <ClassroomScene
                        isRateLimited={isRateLimited}
                        remainingSeconds={remainingSeconds}
                        trackRequest={trackRequest}
                                                currentStep={lesson.timeline[currentStepIndex]}
                        timeline={lesson.timeline}
                        isPlaying={isPlaying}
                        onPauseToggle={() => setIsPlaying(!isPlaying)}
                        onStepChange={(index) => {
                          setCurrentStepIndex(index);
                          setInterruptedDoubt(null);
                          setIsPlaying(false);
                        }}
                        currentStepIndex={currentStepIndex}
                        totalSteps={lesson.timeline.length}
                        interruptedDoubt={interruptedDoubt}
                        onResolveInterruption={resolveDoubtAndResume}
                        language={language}
                        onDialogueComplete={handleStepComplete}
                        isDarkMode={isDarkMode}
                        isListening={isListening}
                        toggleListening={toggleListening}
                        isWaitingForUserVoice={isWaitingForUserVoice}
                        onDoubtPromptComplete={handleDoubtPromptComplete}
                        isResolvingDoubt={isResolvingDoubt}
                        doubtText={doubtText}
                        setDoubtText={setDoubtText}
                        submitDoubt={submitDoubt}
                        avatarSkinColor={avatarSkinColor}
                        avatarOutfitColor={avatarOutfitColor}
                        avatarHairColor={avatarHairColor}
                        avatarHairStyle={avatarHairStyle}
                        avatarGlassesColor={avatarGlassesColor}
                        gender={gender}
                        teacherVoice={teacherVoice}
                        onVoiceChange={setTeacherVoice}
                        onFullscreenChange={(fullscreen) => setIsClassroomFullscreen(fullscreen)}
                      />
                    </div>

                    <div className={`flex-1 rounded-3xl p-6 shadow-2xl border-4 relative overflow-hidden flex flex-col gap-5 transition-colors duration-300 ${
                      isDarkMode ? "bg-slate-900 border-yellow-600 text-slate-100" : "bg-white border-yellow-400 text-slate-850"
                    }`}>
                      
                      {/* Visual header */}
                      <div className={`flex items-center justify-between border-b-2 pb-4 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                        <div className="flex items-center gap-2">
                          <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                            <Award className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className={`text-base font-extrabold transition-colors ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
                              Classroom Assessment Challenge
                            </h4>
                            <p className={`text-[11px] font-bold transition-colors ${isDarkMode ? "text-slate-400" : "text-slate-400"}`}>
                              Score 100% to earn the golden classroom sticker!
                            </p>
                          </div>
                        </div>
                        
                        {quizSubmitted && (
                          <div className="text-right">
                            <span className="text-xs font-extrabold text-slate-400 uppercase">Your Grade</span>
                            <p className="text-2xl font-black text-indigo-400">
                              {quizScore} / {lesson.quiz.length}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* AI Teacher Personalized Encouraging Feedback */}
                      {quizSubmitted && quizFeedback && (
                        <div className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row gap-3.5 items-start transition-all ${
                          isDarkMode 
                            ? "bg-slate-950/40 border-indigo-500/30 text-slate-200" 
                            : "bg-indigo-50/50 border-indigo-200 text-slate-800"
                        }`}>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-2xl">👩‍🏫</span>
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 block leading-none">AI Teacher</span>
                              <span className="text-[10px] font-bold text-slate-400">Personalized Feedback</span>
                            </div>
                          </div>
                          <div className="flex-1 text-xs leading-relaxed space-y-1">
                            <div className="whitespace-pre-wrap">{renderBoldText(quizFeedback)}</div>
                          </div>
                        </div>
                      )}

                      {/* Retry Mode Active Banner */}
                      {quizFilterIndices && (
                        <div className={`p-3 rounded-2xl flex items-center justify-between text-xs font-bold transition-all ${
                          isDarkMode 
                            ? "bg-amber-950/20 border border-amber-500/25 text-amber-200" 
                            : "bg-amber-50 border border-amber-200 text-amber-800"
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className="animate-pulse">🎯</span>
                            <span>Retry Mode Active: Focusing on {quizFilterIndices.length} incorrect questions</span>
                          </div>
                          <button
                            onClick={handleShowAllQuizQuestions}
                            className={`px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider font-extrabold border transition-all cursor-pointer ${
                              isDarkMode 
                                ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300" 
                                : "bg-white border-slate-200 hover:bg-slate-100 text-slate-700"
                            }`}
                          >
                            Show All Questions
                          </button>
                        </div>
                      )}

                      {/* Quiz Questions List */}
                      <div className="space-y-6 flex-1 overflow-y-auto max-h-[350px] pr-2">
                        {lesson.quiz
                          .map((q, qIdx) => ({ ...q, originalIdx: qIdx }))
                          .filter((item) => quizFilterIndices === null || quizFilterIndices.includes(item.originalIdx))
                          .map((q) => {
                            const qIdx = q.originalIdx;
                            return (
                              <div
                                key={qIdx}
                                className={`p-4 rounded-2xl border-2 transition-all ${
                                  quizSubmitted
                                    ? quizAnswers[qIdx] === q.correctIndex
                                      ? isDarkMode
                                        ? "bg-emerald-950/20 border-emerald-800 text-emerald-200"
                                        : "bg-emerald-50 border-emerald-300"
                                      : isDarkMode
                                        ? "bg-red-950/20 border-red-900 text-red-200"
                                        : "bg-red-50 border-red-300"
                                    : isDarkMode
                                      ? "bg-slate-800/40 border-slate-800 text-slate-100"
                                      : "bg-slate-50 border-slate-100 text-slate-700"
                                }`}
                              >
                                <h5 className={`text-xs font-extrabold mb-3 flex gap-2 ${isDarkMode ? "text-slate-100" : "text-slate-700"}`}>
                                  <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-[10px]">
                                    Q{qIdx + 1}
                                  </span>
                                  {q.question}
                                </h5>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {q.options.map((opt, oIdx) => {
                                    const isSelected = quizAnswers[qIdx] === oIdx;
                                    const isCorrect = oIdx === q.correctIndex;
                                    
                                    let buttonStyles = isDarkMode
                                      ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";
                                    if (isSelected) {
                                      buttonStyles = "bg-indigo-600 border-indigo-600 text-white shadow";
                                    }
                                    
                                    if (quizSubmitted) {
                                      if (isCorrect) {
                                        buttonStyles = "bg-emerald-500 border-emerald-500 text-white";
                                      } else if (isSelected) {
                                        buttonStyles = "bg-red-500 border-red-500 text-white";
                                      } else {
                                        buttonStyles = isDarkMode
                                          ? "bg-slate-900/40 border-slate-800 text-slate-500 opacity-60"
                                          : "bg-slate-100 border-slate-200 text-slate-400 opacity-60";
                                      }
                                    }

                                    return (
                                      <button
                                        key={oIdx}
                                        onClick={() => handleSelectQuizOption(qIdx, oIdx)}
                                        disabled={quizSubmitted}
                                        className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center justify-between ${buttonStyles}`}
                                      >
                                        <span>{opt}</span>
                                        {quizSubmitted && isCorrect && <CheckCircle2 className="w-4 h-4 shrink-0 text-white ml-2" />}
                                        {quizSubmitted && isSelected && !isCorrect && <XCircle className="w-4 h-4 shrink-0 text-white ml-2" />}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Interactive explanation/coaching message */}
                                {quizSubmitted && (
                                  <div className={`mt-3 p-2.5 rounded-xl border border-dashed text-[11px] font-medium flex items-start gap-2 ${
                                    isDarkMode
                                      ? "bg-slate-850/60 border-slate-700 text-slate-300"
                                      : "bg-white border-slate-200 text-slate-500"
                                  }`}>
                                    <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                    <p>{q.explanation}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>

                      {/* Quiz Controls */}
                      <div className={`flex items-center justify-between border-t pt-4 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                        <button
                          onClick={() => {
                            setQuizAnswers({});
                            setQuizSubmitted(false);
                            setQuizFilterIndices(null);
                            setQuizFeedback("");
                          }}
                          className={`flex items-center gap-1.5 text-xs font-extrabold transition-all ${
                            isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Reset Quiz Options</span>
                        </button>

                        {!quizSubmitted ? (
                          <button
                            onClick={checkQuizResults}
                            disabled={Object.keys(quizAnswers).length < lesson.quiz.length}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
                          >
                            <span>Grade My Answers</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            {/* Retry Incorrect Button - only shown if there are incorrect answers */}
                            {lesson.quiz.some((q, idx) => quizAnswers[idx] !== q.correctIndex) && (
                              <button
                                onClick={handleRetryIncorrectQuestions}
                                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-95 animate-pulse"
                                title="Retry only questions answered incorrectly"
                              >
                                <span>🎯 Retry Incorrect</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setActiveTab("lesson");
                                setCurrentStepIndex(0);
                                setIsPlaying(true);
                              }}
                              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
                            >
                              <span>Review Lessons Again</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Raise Hand / Ask a Doubt Section */}
              <div className={`transition-colors duration-300 rounded-3xl border-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center p-3 gap-3 ${
                isDarkMode ? "bg-slate-900/90 backdrop-blur border-slate-800 text-slate-100" : "bg-white/90 backdrop-blur border-white text-slate-800"
              }`}>
                <div className="flex items-center gap-2 px-2">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-lg animate-bounce">
                    ✋
                  </div>
                  <div>
                    <h5 className={`text-xs font-black leading-none transition-colors ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>Raise Hand</h5>
                    <p className={`text-[9px] font-semibold uppercase transition-colors ${isDarkMode ? "text-slate-400" : "text-slate-400"}`}>Ask a Doubt</p>
                  </div>
                </div>

                {/* Textbox for Question Input */}
                <div className="flex-1 flex gap-2 items-center">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder={isRateLimited ? `Teacher is taking a quick breather (${remainingSeconds}s remaining)...` : isListening ? "Listening... Speak your question!" : "Why is chlorophyll green? Ask the AI Teacher mid-lesson..."}
                      value={doubtText}
                      onChange={(e) => setDoubtText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          submitDoubt();
                        }
                      }}
                      disabled={isResolvingDoubt}
                      className={`w-full py-3.5 pl-4 pr-12 rounded-2xl border-2 outline-none font-medium text-xs transition-all ${
                        isDarkMode ? "bg-slate-800 border-slate-750 text-white placeholder:text-slate-500" : "bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-500"
                      } ${
                        isListening ? "border-red-500 ring-2 ring-red-100" : "border-slate-200 focus:border-indigo-500"
                      }`}
                    />
                    <button
                      onClick={() => submitDoubt()}
                      disabled={isResolvingDoubt || !doubtText.trim() || isRateLimited}
                      className="absolute right-2 top-2.5 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      {isResolvingDoubt ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Raise Hand / Ask Doubt voice dictation button */}
                  <button
                    onClick={toggleListening}
                    disabled={isResolvingDoubt}
                    title={isListening ? "Stop listening" : "Raise Hand / Ask Doubt"}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 border-2 ${
                      isListening
                        ? "bg-red-500 border-red-600 text-white animate-pulse shadow-md shadow-red-200"
                        : isDarkMode
                          ? "bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-750"
                          : "bg-amber-400 border-amber-500 text-slate-950 hover:bg-amber-300"
                    }`}
                  >
                    <Hand className={`w-5 h-5 ${isListening ? "animate-bounce" : ""}`} />
                  </button>
                </div>

                {/* Progress bar info panel */}
                <div className="shrink-0 flex flex-col justify-center px-2 text-right">
                  <div className={`text-[10px] uppercase font-extrabold transition-colors ${isDarkMode ? "text-slate-400" : "text-gray-400"}`}>
                    Lesson Timeline
                  </div>
                  <div className={`w-28 h-3 rounded-full mt-1 overflow-hidden relative transition-colors ${isDarkMode ? "bg-slate-800" : "bg-gray-200"}`}>
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{
                        width: `${((currentStepIndex + 1) / lesson.timeline.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* Welcome / Onboarding Empty State placeholder */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto relative z-10">
              <div className={`relative w-24 h-24 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.5)] border-4 mb-4 transition-colors ${
                isDarkMode ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 border-indigo-400" : "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 border-indigo-300"
              }`}>
                <BookOpen className="w-12 h-12 text-white animate-pulse" />
              </div>
              
              <h2 className={`text-xl font-black font-sans tracking-tight mb-1 transition-colors ${
                isDarkMode ? "text-slate-100" : "text-slate-800"
              }`}>
                Welcome to <span className={isDarkMode ? "text-blue-400" : "text-blue-600"}>Classroom</span><span className="text-orange-500">LM</span>!
              </h2>
              <p className={`text-xs font-semibold mb-4 max-w-xs font-sans leading-relaxed transition-colors ${
                isDarkMode ? "text-slate-300" : "text-slate-600"
              }`}>
                Transform study guides, videos, or prompts into a magical animated classroom with your friendly AI teacher!
              </p>

              <div className={`p-3 rounded-2xl border-2 text-left w-full shadow-sm transition-colors mb-4 ${
                isDarkMode ? "bg-slate-900/80 border-yellow-600/30 text-slate-300" : "bg-white/80 border-yellow-400/30 text-slate-700"
              }`}>
                <h4 className={`text-xs font-bold mb-1 flex items-center gap-1.5 transition-colors ${
                  isDarkMode ? "text-slate-200" : "text-slate-700"
                }`}>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  Quick Steps:
                </h4>
                <ol className={`space-y-1 text-[10px] font-semibold transition-colors ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}>
                  <li>1. Type a topic or choose a suggestion on the left.</li>
                  <li>2. Select options and click "Generate AI Lesson" to start!</li>
                </ol>
              </div>
            </div>
          )}

          </div>
        </section>
              </motion.div>
        <HelpOverlay isDarkMode={isDarkMode} />
      </main>

      {/* Fullscreen Image Overlay */}
      <AnimatePresence>
        {isFullscreenImage && generatedImageUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4"
          >
            {/* Top control bar */}
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ delay: 0.1, duration: 0.2 }}
              className="absolute top-4 right-4 flex items-center gap-3 z-[210]"
            >
              {!isAnnotatorActive && (
                <button
                  onClick={() => setIsAnnotatorActive(true)}
                  className="p-2.5 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white rounded-full transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95 flex items-center gap-1.5 px-4 text-xs font-bold"
                  title="Add Highlights & Labels"
                >
                  <Palette className="w-4 h-4 animate-pulse" />
                  <span>Annotate Diagram</span>
                </button>
              )}
              <button
                onClick={() => handleShareImage(generatedImageUrl)}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95 flex items-center gap-1.5 px-4 text-xs font-bold"
                title="Share Diagram"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Diagram</span>
              </button>
              <button
                onClick={() => handleDownloadImage(generatedImageUrl, "study-diagram.jpg")}
                className="p-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-full transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95 flex items-center gap-1.5 px-4 text-xs font-bold"
                title="Download Image"
              >
                <Download className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button 
                onClick={() => {
                  setIsFullscreenImage(false);
                  setIsAnnotatorActive(false);
                }}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
                title="Close Fullscreen"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>

            {isAnnotatorActive ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-5xl bg-slate-900/90 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden mt-12"
              >
                <ImageAnnotator
                  imageUrl={generatedImageUrl}
                  isDarkMode={isDarkMode}
                  onSave={(annotatedDataUrl) => {
                    setGeneratedImageUrl(annotatedDataUrl);
                    // Also replace in the gallery list if it exists
                    setGeneratedImagesList(prev => prev.map(url => url === generatedImageUrl ? annotatedDataUrl : url));
                    setIsAnnotatorActive(false);
                    showToast("Annotations applied and saved!");
                  }}
                  onClose={() => setIsAnnotatorActive(false)}
                />
              </motion.div>
            ) : (
              <motion.div 
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="max-w-[95vw] max-h-[85vh] flex items-center justify-center relative mt-12"
              >
                <img 
                  src={generatedImageUrl} 
                  alt="Fullscreen generated educational illustration" 
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/15"
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Homework Coach Multi-Modal Chat Widget */}
      {!isClassroomFullscreen && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {isHomeworkChatOpen && (
            <div className={`w-[92vw] max-w-sm h-[520px] rounded-3xl border-4 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
              isDarkMode 
                ? `bg-slate-900 ${CHAT_THEMES[homeworkChatTheme].windowBorder.dark}` 
                : `bg-white ${CHAT_THEMES[homeworkChatTheme].windowBorder.light}`
            }`}>
              {/* Header */}
              <div className={`${CHAT_THEMES[homeworkChatTheme].headerBg} p-4 text-white flex items-center justify-between shrink-0 relative transition-all duration-300`}>
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg shadow-inner">
                      🎓
                    </div>
                    <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-400 border-2 rounded-full animate-pulse ${
                      homeworkChatTheme === "Default" ? "border-indigo-600" :
                      homeworkChatTheme === "Ocean" ? "border-sky-600" :
                      homeworkChatTheme === "Forest" ? "border-emerald-600" :
                      "border-orange-500"
                    }`} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-tight flex items-center gap-1">
                      Homework Coach <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin-slow" />
                    </h3>
                    <p className="text-[9px] text-white/90 font-bold uppercase tracking-wider">
                      {gradeLevel} • {language}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {homeworkChatMessages.length > 0 && (
                    <button
                      onClick={() => setHomeworkChatMessages([])}
                      className="p-1.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer text-white mr-1"
                      title="Clear Chat History"
                      id="clear-homework-chat-button"
                    >
                      <Trash2 className="w-4 h-4 text-white/80 hover:text-white transition-colors" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsHomeworkChatOpen(false)}
                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabs Bar */}
              <div className={`flex border-b text-[11px] font-bold shrink-0 ${
                isDarkMode ? "bg-slate-950 border-slate-850" : "bg-slate-100 border-slate-200"
              }`}>
                <button
                  onClick={() => setChatTab("chat")}
                  className={`flex-1 py-2 text-center transition-all border-b-2 cursor-pointer ${
                    chatTab === "chat"
                      ? homeworkChatTheme === "Default" ? "border-indigo-600 text-indigo-500 font-extrabold" :
                        homeworkChatTheme === "Ocean" ? "border-sky-600 text-sky-500 font-extrabold" :
                        homeworkChatTheme === "Forest" ? "border-emerald-600 text-emerald-600 font-extrabold" :
                        "border-orange-500 text-orange-500 font-extrabold"
                      : isDarkMode
                        ? "border-transparent text-slate-400 hover:text-slate-200"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Chat Feed
                </button>
                <button
                  onClick={() => setChatTab("gallery")}
                  className={`flex-1 py-2 text-center transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1 ${
                    chatTab === "gallery"
                      ? homeworkChatTheme === "Default" ? "border-indigo-600 text-indigo-500 font-extrabold" :
                        homeworkChatTheme === "Ocean" ? "border-sky-600 text-sky-500 font-extrabold" :
                        homeworkChatTheme === "Forest" ? "border-emerald-600 text-emerald-600 font-extrabold" :
                        "border-orange-500 text-orange-500 font-extrabold"
                      : isDarkMode
                        ? "border-transparent text-slate-400 hover:text-slate-200"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Generated Images ({generatedImagesList.length})
                </button>
              </div>

              {/* Environment Study Theme Picker Row */}
              <div className={`px-3.5 py-2 border-b flex items-center justify-between shrink-0 text-[10px] font-bold transition-all ${
                isDarkMode ? "bg-slate-900/40 border-slate-850" : "bg-slate-50 border-slate-200"
              }`}>
                <span className={`flex items-center gap-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  <span>🎨</span>
                  <span>Study Theme:</span>
                </span>
                <div className="flex gap-1">
                  {[
                    { id: "Default", label: "Default" },
                    { id: "Ocean", label: "Ocean" },
                    { id: "Forest", label: "Forest" },
                    { id: "Sunset", label: "Sunset" }
                  ].map((t) => {
                    const isSelected = homeworkChatTheme === t.id;
                    let btnColor = "";
                    if (isSelected) {
                      btnColor = CHAT_THEMES[t.id as keyof typeof CHAT_THEMES].activeBtn;
                    } else {
                      btnColor = isDarkMode 
                        ? "bg-slate-800 border-slate-750 text-slate-400 hover:bg-slate-750 hover:text-slate-200" 
                        : "bg-white border-slate-200 text-slate-550 hover:bg-slate-50 hover:text-slate-800";
                    }
                    return (
                      <button
                        key={t.id}
                        onClick={() => setHomeworkChatTheme(t.id as any)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border transition-all cursor-pointer ${btnColor}`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {chatTab === "gallery" ? (
                <div className={`flex-1 overflow-y-auto p-4 flex flex-col gap-3 ${
                  isDarkMode ? "bg-slate-950" : "bg-slate-50/80"
                }`}>
                  {generatedImagesList.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 gap-2">
                      <ImageIcon className="w-12 h-12 text-slate-500/50 animate-pulse" />
                      <p className="text-xs font-semibold">No generated images yet.</p>
                      <p className="text-[10px] text-slate-500">Use the image generator tool in the chat to create illustrations!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {generatedImagesList.map((imgUrl, i) => {
                        const isSelected = selectedGalleryImageIdx === i;
                        return (
                          <div 
                            key={i} 
                            onClick={() => setSelectedGalleryImageIdx(isSelected ? null : i)}
                            className={`rounded-xl overflow-hidden border bg-slate-900 shadow-md flex flex-col transition-all duration-200 cursor-pointer ${
                              isSelected 
                                ? "border-indigo-500 ring-2 ring-indigo-500/20 scale-[1.01]" 
                                : "border-slate-750/50 hover:border-slate-600 hover:scale-[1.01]"
                            }`}
                          >
                            <div className="relative aspect-square w-full">
                              <img 
                                src={imgUrl} 
                                alt={`Generated image ${i + 1}`} 
                                className="w-full h-full object-cover select-none"
                                referrerPolicy="no-referrer"
                              />
                              {/* Selection overlay or checkmark */}
                              {isSelected && (
                                <div className="absolute inset-0 bg-slate-950/25 flex items-center justify-center">
                                  <div className="p-1 bg-indigo-600 text-white rounded-full shadow-lg">
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <div 
                                className="flex border-t border-slate-750/40 p-1 bg-slate-950 gap-1 shrink-0 animate-fade-in"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => {
                                    setGeneratedImageUrl(imgUrl);
                                    setIsFullscreenImage(true);
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold cursor-pointer transition-colors"
                                  title="View Full Screen"
                                >
                                  <Maximize className="w-2.5 h-2.5" />
                                  <span>View</span>
                                </button>
                                <button
                                  onClick={() => handleDownloadImage(imgUrl, `generated-image-${i + 1}.jpg`)}
                                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-[9px] font-bold cursor-pointer transition-colors"
                                  title="Download Image"
                                >
                                  <Download className="w-2.5 h-2.5" />
                                  <span>Save</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Messages Feed */}
                  <div 
                    ref={chatFeedRef}
                    className={`flex-1 overflow-y-auto p-4 flex flex-col gap-3 ${
                      isDarkMode ? "bg-slate-950" : "bg-slate-50/80"
                    }`}
                  >
                    {homeworkChatMessages.map((msg, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                      >
                        <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed font-sans shadow-sm transition-all duration-300 ${
                          msg.sender === "user"
                            ? CHAT_THEMES[homeworkChatTheme].userBubble
                            : isDarkMode
                            ? CHAT_THEMES[homeworkChatTheme].tutorBubble.dark
                            : CHAT_THEMES[homeworkChatTheme].tutorBubble.light
                        }`}>
                          {msg.attachedImageBase64 && (
                            <div className="mb-2 rounded-lg overflow-hidden border border-white/20 bg-black/10 flex flex-col">
                              <img 
                                src={msg.attachedImageBase64.startsWith('data:') ? msg.attachedImageBase64 : `data:image/jpeg;base64,${msg.attachedImageBase64}`}
                                alt="Attached or Generated"
                                className="w-full max-h-48 object-contain"
                                referrerPolicy="no-referrer"
                              />
                              <div className="flex border-t border-white/10 p-1 bg-black/30 gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    const imgUrl = msg.attachedImageBase64!.startsWith('data:') ? msg.attachedImageBase64! : `data:image/jpeg;base64,${msg.attachedImageBase64!}`;
                                    setGeneratedImageUrl(imgUrl);
                                    setIsFullscreenImage(true);
                                  }}
                                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-white text-[9px] font-bold cursor-pointer transition-colors ${
                                    homeworkChatTheme === "Default" ? "bg-indigo-600/80 hover:bg-indigo-600" :
                                    homeworkChatTheme === "Ocean" ? "bg-sky-600/80 hover:bg-sky-600" :
                                    homeworkChatTheme === "Forest" ? "bg-emerald-600/80 hover:bg-emerald-600" :
                                    "bg-orange-600/80 hover:bg-orange-600"
                                  }`}
                                  title="View Full Screen"
                                >
                                  <Maximize className="w-2.5 h-2.5" />
                                  <span>View Large</span>
                                </button>
                                <button
                                  onClick={() => {
                                    const imgUrl = msg.attachedImageBase64!.startsWith('data:') ? msg.attachedImageBase64! : `data:image/jpeg;base64,${msg.attachedImageBase64!}`;
                                    handleDownloadImage(imgUrl, `classroom-image-${idx}.jpg`);
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-teal-600/80 hover:bg-teal-500 text-white text-[9px] font-bold cursor-pointer transition-colors"
                                  title="Download Image"
                                >
                                  <Download className="w-2.5 h-2.5" />
                                  <span>Download</span>
                                </button>
                              </div>
                            </div>
                          )}
                          {msg.attachedVideoBase64 && (
                            <div className="mb-2 rounded-lg overflow-hidden border border-white/20 bg-black/10 flex flex-col">
                              <video 
                                src={msg.attachedVideoBase64.startsWith('data:') ? msg.attachedVideoBase64 : `data:video/mp4;base64,${msg.attachedVideoBase64}`}
                                controls
                                className="w-full max-h-48 object-contain"
                              />
                            </div>
                          )}
                          {/* Render message text */}
                          <p className="whitespace-pre-line font-medium">{msg.text.replace(/\[.*?\]/g, "").trim()}</p>
                          
                          {msg.sender === "tutor" && (
                            <div className="mt-2 flex justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  const textToAsk = `I didn't fully understand this part: "${msg.text.slice(0, 100)}...". Can you please explain it again in a simpler or different way?`;
                                  handleSendHomeworkChatMessage(textToAsk);
                                }}
                                className={`p-1.5 px-2 rounded-full flex items-center justify-center gap-1 transition-all cursor-pointer text-[10px] font-bold ${
                                  isDarkMode
                                    ? `bg-slate-800/80 ${CHAT_THEMES[homeworkChatTheme].iconColor} hover:bg-slate-700/80`
                                    : `bg-slate-100/80 ${CHAT_THEMES[homeworkChatTheme].iconColor} hover:bg-slate-200/80`
                                }`}
                                title="Ask for a simpler explanation"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Ask Again</span>
                              </button>
                              <button
                                onClick={() => handlePlayMessage(msg.text, idx)}
                                className={`p-1.5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                  playingMessageIdx === idx
                                    ? homeworkChatTheme === "Default" ? "bg-indigo-500 text-white animate-pulse" :
                                      homeworkChatTheme === "Ocean" ? "bg-sky-500 text-white animate-pulse" :
                                      homeworkChatTheme === "Forest" ? "bg-emerald-650 text-white animate-pulse" :
                                      "bg-orange-500 text-white animate-pulse"
                                    : isDarkMode
                                      ? `bg-slate-800 ${CHAT_THEMES[homeworkChatTheme].iconColor} hover:bg-slate-705`
                                      : `bg-slate-100/80 ${CHAT_THEMES[homeworkChatTheme].iconColor} hover:bg-slate-200/80`
                                }`}
                                title={playingMessageIdx === idx ? "Stop Listening" : "Listen to Message"}
                              >
                                {playingMessageIdx === idx ? <StopCircle className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}

                          {/* Render attachment badges inside the bubble! */}
                          {(msg.attachedImageName || msg.attachedVideoName || msg.youtubeUrl) && (
                            <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1 text-[10px]">
                              {msg.attachedImageName && (
                                <div className="flex items-center gap-1.5 opacity-90 font-bold">
                                  <ImageIcon className="w-3.5 h-3.5 text-blue-300" />
                                  <span className="truncate max-w-[150px]">{msg.attachedImageName}</span>
                                </div>
                              )}
                              {msg.attachedVideoName && (
                                <div className="flex items-center gap-1.5 opacity-90 font-bold">
                                  <Video className="w-3.5 h-3.5 text-purple-300" />
                                  <span className="truncate max-w-[150px]">{msg.attachedVideoName}</span>
                                </div>
                              )}
                              {msg.youtubeUrl && (
                                <a
                                  href={msg.youtubeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 opacity-90 hover:opacity-100 underline text-red-350 font-bold"
                                >
                                  <Link className="w-3.5 h-3.5" />
                                  <span>YouTube Video Reference</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    
                    {isHomeworkChatLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed font-sans shadow-sm rounded-bl-none flex items-center gap-2 ${
                          isDarkMode
                            ? CHAT_THEMES[homeworkChatTheme].tutorBubble.dark
                            : CHAT_THEMES[homeworkChatTheme].tutorBubble.light
                        }`}>
                          <div className="flex gap-1 items-center justify-center w-4 h-4">
                            <span className={`w-1 h-1 rounded-full animate-bounce ${CHAT_THEMES[homeworkChatTheme].iconColor}`} style={{ animationDelay: '0ms' }} />
                            <span className={`w-1 h-1 rounded-full animate-bounce ${CHAT_THEMES[homeworkChatTheme].iconColor}`} style={{ animationDelay: '150ms' }} />
                            <span className={`w-1 h-1 rounded-full animate-bounce ${CHAT_THEMES[homeworkChatTheme].iconColor}`} style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="italic">Coach is explaining...</span>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Attachments Draft Preview Area */}
                  {(attachedImage || attachedVideo || chatYoutubeUrl || transcribingAudio) && (
                    <div className={`p-2 px-3 border-t flex flex-wrap gap-2 items-center ${
                      isDarkMode ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      {attachedImage && (
                        <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-500 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-blue-500/25 relative group">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[100px]">{attachedImage.name}</span>
                          <button
                            onClick={() => setAttachedImage(null)}
                            className="ml-1 p-0.5 hover:bg-red-500 hover:text-white rounded-full transition-all cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      
                      {attachedVideo && (
                        <div className="flex items-center gap-1.5 bg-purple-500/10 text-purple-500 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-purple-500/25 relative group">
                          <Video className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[100px]">{attachedVideo.name}</span>
                          <button
                            onClick={() => setAttachedVideo(null)}
                            className="ml-1 p-0.5 hover:bg-red-500 hover:text-white rounded-full transition-all cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {chatYoutubeUrl && (
                        <div className="flex items-center gap-1.5 bg-red-500/10 text-red-500 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-red-500/25 relative group">
                          <Link className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[100px]">{chatYoutubeUrl}</span>
                          <button
                            onClick={() => setChatYoutubeUrl("")}
                            className="ml-1 p-0.5 hover:bg-red-500 hover:text-white rounded-full transition-all cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {transcribingAudio && (
                        <div className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-yellow-500/25 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin text-yellow-500" />
                          <span>Transcribing voice...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Input Bar and Multimodal Action Controls */}
                  <div className={`p-3 border-t flex flex-col gap-2 ${
                    isDarkMode ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    {/* Media Controls Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {/* Magic Camera Button */}
                        <button
                          onClick={() => setIsMagicCameraOpen(true)}
                          className="p-1.5 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 hover:from-purple-500/20 hover:to-cyan-500/20 dark:from-purple-500/20 dark:to-cyan-500/20 dark:hover:from-purple-500/30 dark:hover:to-cyan-500/30 text-cyan-500 hover:text-cyan-400 dark:text-cyan-400 dark:hover:text-cyan-300 rounded-lg transition-all cursor-pointer relative shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] active:scale-95 border border-cyan-500/30 hover:border-purple-500/50" 
                          title="Magic Camera (Scan Homework)"
                        >
                          <Camera className="w-4 h-4" />
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping opacity-75" />
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-400 rounded-full opacity-90" />
                        </button>
                        
                        {/* Image Attachment Button */}
                        <label className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer relative" title="Attach Image">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleChatImageUpload}
                            className="hidden"
                          />
                          <ImageIcon className="w-4 h-4" />
                        </label>

                        {/* Video Attachment Button */}
                        <label className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-violet-500 hover:text-violet-600 rounded-lg transition-colors cursor-pointer relative" title="Attach Video File">
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleChatVideoUpload}
                            className="hidden"
                          />
                          <Video className="w-4 h-4" />
                        </label>

                        {/* Audio Upload Button */}
                        <label className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-sky-500 hover:text-sky-600 rounded-lg transition-colors cursor-pointer relative" title="Upload Audio File for Transcription">
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleChatAudioUpload}
                            className="hidden"
                          />
                          <Paperclip className="w-4 h-4" />
                        </label>

                        {/* Voice Record Mic Button */}
                        <button
                          onClick={isChatRecordingAudio ? stopChatAudioRecording : startChatAudioRecording}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                            isChatRecordingAudio 
                              ? "bg-red-500 text-white animate-pulse" 
                              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-500 hover:text-amber-600"
                          }`}
                          title={isChatRecordingAudio ? "Stop Recording Voice" : "Record voice to type"}
                        >
                          <Mic className="w-4 h-4" />
                        </button>

                        {/* YouTube Link Prompt Trigger */}
                        <button
                          onClick={() => {
                            const url = prompt("Paste a YouTube Video URL to analyze with the coach:");
                            if (url) {
                              setChatYoutubeUrl(url);
                            }
                          }}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-red-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                          title="Reference YouTube Video"
                        >
                          <Link className="w-4 h-4" />
                        </button>

                        {/* Generate Image Button */}
                        <button
                          onClick={() => setIsImageGeneratorOpen(!isImageGeneratorOpen)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                            isImageGeneratorOpen ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-500 hover:text-emerald-600"
                          }`}
                          title="Generate Image"
                        >
                          <Palette className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {isChatRecordingAudio && (
                        <span className="text-[9px] font-black uppercase text-red-500 tracking-wider animate-pulse flex items-center gap-1">
                          🔴 Recording...
                        </span>
                      )}
                    </div>

                    {isImageGeneratorOpen && (
                      <div className={`p-2 rounded-xl mb-2 text-xs flex flex-col gap-2 ${
                        isDarkMode ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between px-1">
                          <span className={`font-semibold flex items-center gap-1.5 ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>
                            <Wand2 className="w-3 h-3" /> Generate High-Quality Image
                          </span>
                          <button onClick={() => setIsImageGeneratorOpen(false)} className="opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
                        </div>
                        <textarea 
                          placeholder="Describe the image you want to generate..." 
                          className={`w-full p-2 rounded-md border text-xs resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                            isDarkMode ? "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500" : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400"
                          }`}
                          rows={2}
                          value={imageGeneratorPrompt}
                          onChange={(e) => setImageGeneratorPrompt(e.target.value)}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex gap-1.5">
                            <select 
                              value={imageGeneratorSize}
                              onChange={(e) => setImageGeneratorSize(e.target.value)}
                              className={`text-xs p-1 rounded border outline-none cursor-pointer ${
                                isDarkMode ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"
                              }`}
                              title="Image Resolution"
                            >
                              <option value="1K">1K Resolution</option>
                              <option value="2K">2K Resolution</option>
                              <option value="4K">4K Resolution</option>
                            </select>

                            <select 
                              value={imageGeneratorStyle}
                              onChange={(e) => setImageGeneratorStyle(e.target.value as any)}
                              className={`text-xs p-1 rounded border outline-none cursor-pointer ${
                                isDarkMode ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"
                              }`}
                              title="Diagram Style"
                            >
                              <option value="Diagram">Diagram</option>
                              <option value="Sketch">Sketch</option>
                              <option value="Photorealistic">Photorealistic</option>
                            </select>
                          </div>

                          <button 
                            onClick={handleGenerateChatImage}
                            disabled={isGeneratingChatImage || !imageGeneratorPrompt.trim()}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            {isGeneratingChatImage ? <RefreshCw className="w-3 h-3 animate-spin text-white/70" /> : <Palette className="w-3 h-3" />}
                            {isGeneratingChatImage ? "Generating..." : "Generate"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TextInput / Send Row */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={isChatRecordingAudio ? "Recording live..." : "Ask the coach anything..."}
                        value={homeworkChatInput}
                        onChange={(e) => setHomeworkChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSendHomeworkChatMessage();
                          }
                        }}
                        disabled={isChatRecordingAudio}
                        className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold outline-none focus:border-indigo-500 transition-colors ${
                          isDarkMode
                            ? "bg-slate-950 border-slate-750 text-slate-100 placeholder:text-slate-500"
                            : "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-600 focus:bg-white"
                        }`}
                      />
                      <button
                        onClick={handleSendHomeworkChatMessage}
                        disabled={isHomeworkChatLoading || isChatRecordingAudio || (!homeworkChatInput.trim() && !attachedImage && !attachedVideo && !chatYoutubeUrl)}
                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            id="floating-chat-trigger"
            onClick={() => setIsHomeworkChatOpen(!isHomeworkChatOpen)}
            className="h-14 w-14 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-500 hover:via-indigo-500 hover:to-indigo-600 text-white shadow-xl hover:shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-white relative group cursor-pointer shrink-0 z-50"
            title={isHomeworkChatOpen ? "Hide Homework Coach" : "Chat with Homework Coach"}
          >
            <MessageCircle className={`w-6 h-6 ${isHomeworkChatOpen ? "" : "animate-bounce"}`} />
            <span className="absolute right-16 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md">
              {isHomeworkChatOpen ? "Hide Homework Coach" : "Chat with Homework Coach"}
            </span>
            <span className={`absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${isHomeworkChatOpen ? "bg-indigo-400" : "bg-green-500"}`} />
          </button>
        </div>
      )}

      <MagicCameraOverlay 
        isOpen={isMagicCameraOpen} 
        onClose={() => setIsMagicCameraOpen(false)} 
        onCapture={async (img, prompt, controller) => {
          setAttachedImage(img);
          await handleSendHomeworkChatMessage(prompt || "Can you explain this homework problem step by step?", img, controller);
        }}
        isDarkMode={isDarkMode}
      />

      <LessonLoadingScreen 
        isVisible={isGenerating} 
        isDarkMode={isDarkMode}
        onCancel={() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
          }
          setIsGenerating(false);
          setAppStage("app");
        }}
        onTimeoutFallback={() => {
          // Just fall back to a mock lesson for now
          setIsGenerating(false);
          setLesson({
            title: customTopic || pastedText || "Fallback Lesson",
            description: "A placeholder lesson in case of timeout.",
            timeline: [
              {
                timestamp: "0:00",
                teacherGesture: "explaining",
                spokenDialogue: "Welcome to the fallback lesson! Our servers were busy, but you can still explore this example.",
                bubbleCaption: "Fallback Lesson Active",
                whiteboardContent: {
                  heading: "Fallback Active",
                  bulletPoints: ["This is a fallback generated locally to ensure you don't get stuck."]
                }
              }
            ],
            quiz: []
          });
          setAppStage("app");
          setActiveTab("lesson");
        }}
      />\n\n            {/* Footer */}
      <footer className={`relative shrink-0 border-t py-3 px-6 flex flex-col sm:flex-row items-center justify-between text-xs z-20 transition-colors duration-300 backdrop-blur-2xl ${
        isDarkMode ? "bg-slate-900/80 border-indigo-500/30 text-slate-400" : "bg-white/80 border-indigo-200/50 text-slate-500"
      }`}>
        <p>© 2026 ClassroomLM. All rights reserved.</p>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-2 sm:mt-0 font-medium">
          <button onClick={() => setActivePolicyPage('about')} className="hover:text-indigo-500 transition-colors">About Us</button>
          <button onClick={() => setActivePolicyPage('privacy')} className="hover:text-indigo-500 transition-colors">Privacy Policy</button>
          <button onClick={() => setActivePolicyPage('terms')} className="hover:text-indigo-500 transition-colors">Terms of Service</button>
          <button onClick={() => setActivePolicyPage('disclaimer')} className="hover:text-indigo-500 transition-colors">AI Disclaimer</button>
        </div>
      </footer>

      {/* Dynamic Status Toast Indicator */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/90 text-white text-xs font-semibold py-2.5 px-5 rounded-full shadow-2xl border border-indigo-500/30 backdrop-blur-md flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PolicyModal pageType={activePolicyPage} onClose={() => setActivePolicyPage(null)} isDarkMode={isDarkMode} />
      </div>
    );
  })();

  return (
    <AnimatePresence mode="wait">
      {showIntro ? (
        <IntroAnimation key="intro" onComplete={handleIntroComplete} isDarkMode={isDarkMode} />
      ) : (
        <motion.div
          key="main-app"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", staggerChildren: 0.08 }}
          className="w-full h-full relative"
        >
          {appContent}
        </motion.div>
      )}
    </AnimatePresence>
  );
}