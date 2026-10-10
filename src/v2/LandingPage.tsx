import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Video, Users, Star, Pin, X, ChevronRight, Menu, Play, Presentation, MessageSquare, Coffee, Search, Bell, Wand2, Camera, Image as ImageIcon, Sparkles, Moon, Sun, Maximize2, Minimize2, User, GraduationCap, Globe, Bookmark, Trash2, ArrowUpRight, LogIn, Zap, AlertTriangle, Check, FileText, Upload, Shield } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { LiquidWave } from './LiquidWave';
import { CameraCapture } from './CameraCapture';
import { MermaidDiagram } from './MermaidDiagram';
import { MagicLensCrop } from './MagicLensCrop';
import { AIMascotHero } from './AIMascotHero';
import { ProfileModal } from './ProfileModal';
import { RadialMenu } from './RadialMenu';
import { SmartCalculator } from './SmartCalculator';
import { useAuth, CREDIT_COSTS, DAILY_CREDITS_QUOTA } from '../firebase/authContext';
import { AuthModal } from '../components/AuthModal';
import { executeRecaptcha } from '../firebase/recaptcha';

interface LandingPageProps {
  onGenerate: (config: any) => void;
  onSaveMagicLens?: (result: string, prompt?: string) => void;
  onSaveSearch?: (query: string, result: string) => void;
  savedLessons?: any[];
  onLoadLesson?: (lesson: any) => void;
  onDeleteLesson?: (id: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export function LandingPage({ 
  onGenerate, 
  onSaveMagicLens, 
  onSaveSearch, 
  savedLessons = [], 
  onLoadLesson, 
  onDeleteLesson, 
  isDarkMode, 
  toggleTheme 
}: LandingPageProps) {
  const { 
    currentUser, 
    credits, 
    deductCredits, 
    getIdToken, 
    isAuthModalOpen, 
    authModalReason, 
    openAuthModal, 
    closeAuthModal,
    savedItems: firestoreSavedItems
  } = useAuth();

  const [creditAlert, setCreditAlert] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [savedFilter, setSavedFilter] = useState<'all' | 'lessons' | 'magic' | 'search'>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<'idle' | 'generating' | 'result'>('idle');
  const [searchResult, setSearchResult] = useState("");
  const [topic, setTopic] = useState("");
  const [persona, setPersona] = useState("Friendly Mentor");
  const [focusArea, setFocusArea] = useState<string[]>([]);
  const [classLevel, setClassLevel] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('profileClass') || "Class 10";
    return "Class 10";
  });
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('profileLang') || "English";
    return "English";
  });
  const [legalContent, setLegalContent] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('profileClass', classLevel);
    }
  }, [classLevel]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('profileLang', language);
    }
  }, [language]);
  
  // Magic Lens States
  const [isMagicMenuOpen, setIsMagicMenuOpen] = useState(false);
  const [magicLensState, setMagicLensState] = useState<'idle' | 'camera' | 'crop' | 'processing' | 'result'>('idle');
  const [magicResult, setMagicResult] = useState("");
  const [magicPrompt, setMagicPrompt] = useState("");
  const [isMagicSaved, setIsMagicSaved] = useState(false);
  const [magicLensImage, setMagicLensImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  
  // Classroom Uploaded File States (PDF or Image)
  const [modalUploadedFile, setModalUploadedFile] = useState<{
    name: string;
    type: string;
    base64: string;
    size: number;
    previewUrl?: string;
  } | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleModalFileUpload = (e: React.ChangeEvent<HTMLInputElement>, kind: 'pdf' | 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const base64 = resultStr.split(',')[1] || '';
      setModalUploadedFile({
        name: file.name,
        type: file.type || (kind === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        base64,
        size: file.size,
        previewUrl: kind === 'image' ? resultStr : undefined
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  
  // Full screen states
  const [isSearchFullScreen, setIsSearchFullScreen] = useState(false);
  const [isMagicFullScreen, setIsMagicFullScreen] = useState(false);
  
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const personas = ["Friendly Mentor", "Strict Academic", "Storyteller", "Exam Specialist"];
  const focusTags = ["Step-by-step Math", "Visual Diagrams", "Exam Prep", "Concept Deep Dive"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveTopic = topic.trim() || (modalUploadedFile ? modalUploadedFile.name.replace(/\.[^/.]+$/, "") : "");
    if (!effectiveTopic && !modalUploadedFile) return;

    // Strict Hard Lock on Generation for Guests
    if (!currentUser) {
      openAuthModal("Sign in required to create interactive lessons.");
      return;
    }

    // Execute reCAPTCHA security verification for classroom generation flow
    try {
      const recaptchaToken = await executeRecaptcha('generate_classroom');
      if (recaptchaToken) {
        console.info('[reCAPTCHA] Verified security token for classroom generation');
      }
    } catch (err) {
      console.warn('[reCAPTCHA] Proceeding with classroom generation:', err);
    }

    // High-Cost Credit Pricing: 50 Credits per Lesson
    const creditRes = await deductCredits(CREDIT_COSTS.LESSON, 'Lessons');
    if (!creditRes.success) {
      setCreditAlert(creditRes.error || "Insufficient credits. Lessons require 50 credits. Your 100 credits will refresh tomorrow at 00:00 UTC.");
      return;
    }

    onGenerate({ 
      topic: effectiveTopic || "Uploaded Study Material", 
      persona, 
      focusArea, 
      classLevel, 
      language,
      uploadedFile: modalUploadedFile
    });
    setIsModalOpen(false);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Strict Hard Lock on AI Search for Guests
    if (!currentUser) {
      openAuthModal("Sign in required to use AI Search.");
      return;
    }

    // High-Cost Credit Pricing: 10 Credits per AI Search
    const creditRes = await deductCredits(CREDIT_COSTS.AI_SEARCH, 'AI Search');
    if (!creditRes.success) {
      setSearchResult(creditRes.error || "Insufficient credits. AI Search requires 10 credits. Your 100 credits will refresh tomorrow at 00:00 UTC.");
      setSearchState('result');
      return;
    }

    setSearchState('generating');
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/search', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: searchQuery })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }
      
      setSearchResult(data.result);
      setSearchState('result');
    } catch (err: any) {
      console.error(err);
      setSearchResult(`Error: ${err.message || "Failed to generate search results."}`);
      setSearchState('result');
    }
  };

  const handleSaveSearchResult = () => {
    if (onSaveSearch && searchQuery && searchResult) {
      onSaveSearch(searchQuery, searchResult);
    }
    setIsSearchOpen(false);
    setSearchState('idle');
    setSearchQuery("");
    setSearchResult("");
  };

  const toggleFocus = (tag: string) => {
    setFocusArea(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleImageSelect = (dataUrl: string) => {
    setMagicLensImage(dataUrl);
    setMagicLensState('crop');
  };

  const processImage = async (dataUrl: string, prompt: string) => {
    // Strict Hard Lock on Magic Lens for Guests
    if (!currentUser) {
      openAuthModal("Sign in required to use Magic Lens visual problem solver.");
      return;
    }

    // High-Cost Credit Pricing: 25 Credits per Magic Lens Scan
    const creditRes = await deductCredits(CREDIT_COSTS.MAGIC_LENS, 'Magic Lens');
    if (!creditRes.success) {
      setMagicResult(creditRes.error || "Insufficient credits. Magic Lens requires 25 credits. Your 100 credits will refresh tomorrow at 00:00 UTC.");
      setMagicLensState('result');
      return;
    }

    setMagicLensState('processing');
    setMagicPrompt(prompt);
    setIsMagicSaved(false);
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: dataUrl, prompt })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to analyze image');
      setMagicResult(data.analysis);
      setMagicLensState('result');
      setIsMagicSaved(false);
      // NOTE: Do NOT auto-save here! The user can choose to Save to Content or Discard in the modal!
    } catch (err: any) {
      console.error(err);
      setMagicResult(`Error: ${err.message || 'Failed to analyze image'}`);
      setMagicLensState('result');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser) {
      openAuthModal("Sign in required to use Magic Lens visual problem solver.");
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      setIsMagicMenuOpen(false);
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          handleImageSelect(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredSavedItems = savedLessons.filter(item => {
    if (savedFilter === 'lessons') return !item.isMagicLens && !item.isAISearch;
    if (savedFilter === 'magic') return item.isMagicLens;
    if (savedFilter === 'search') return item.isAISearch;
    return true;
  });

  const handleOpenSavedItem = (item: any) => {
    setIsSavedDrawerOpen(false);
    if (item.isMagicLens) {
      setMagicResult(item.data?.result || "");
      setMagicLensState('result');
    } else if (item.isAISearch) {
      setSearchQuery(item.title || "AI Search");
      setSearchResult(item.data?.result || "");
      setSearchState('result');
      setIsSearchOpen(true);
    } else {
      // STRICT REQUIREMENT: If user selects a saved lesson in Saved Content,
      // NEVER GENERATE AGAIN! Strictly load the saved lesson directly!
      if (onLoadLesson) {
        onLoadLesson({ ...item, isLoadedFromSaved: true, loadedFromSaved: true });
      }
    }
  };

  return (
    <div className={`w-full min-h-[100dvh] flex flex-col relative overflow-x-hidden transition-colors duration-500 ${isDarkMode ? 'bg-[#050B14] text-white' : 'bg-blue-50 text-slate-900'}`}>
      {/* Dynamic Sky Background (z-0) */}
      <div className="fixed inset-0 z-0 transition-colors duration-1000 ease-in-out pointer-events-none">
        {isDarkMode ? (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0B0F17 0%, #111827 100%)' }} />
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%)' }} />
        )}
      </div>

      {/* Gemini Live Liquid Wave (z-5) */}
      <LiquidWave 
        isModalActive={isModalOpen || isSearchOpen || isMagicMenuOpen || isCalculatorOpen || magicLensState !== 'idle' || isSavedDrawerOpen || !!legalContent} 
        isDarkMode={isDarkMode} 
      />

      {/* Sticky Top Bar Header - Mobile Optimized, Short and Neat */}
      <header className={`fixed top-0 inset-x-0 z-[40] px-2.5 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 flex justify-between items-center transition-all duration-300 ${isScrolled ? (isDarkMode ? 'bg-slate-900/85 backdrop-blur-md border-b border-white/10 shadow-lg' : 'bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm') : 'bg-transparent'}`}>
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
          <img 
            src="/logo512.svg" 
            alt="ClassroomLM Logo" 
            className={`transition-all shrink-0 ${isScrolled ? 'w-6 h-6 sm:w-8 sm:h-8' : 'w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11'}`} 
          />
          <h1 className={`font-black tracking-tight flex items-center gap-1 shrink-0 ${isScrolled ? 'text-base sm:text-lg md:text-xl' : 'text-base sm:text-xl md:text-2xl'} ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} transition-all`}>
            <span>ClassroomLM</span>
            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-400 fill-orange-400 animate-pulse shrink-0" />
          </h1>
        </div>
        
        {/* Header Action Buttons - Short and Neat on Mobile */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2.5 shrink-0">
          {/* High-Cost Credit Counter UI: ⚡ 100 / 100 Credits */}
          <button 
            onClick={() => setIsProfileOpen(true)}
            className={`py-1 px-2 sm:px-2.5 md:px-3 rounded-full border transition-all flex items-center gap-1 sm:gap-1.5 font-bold text-xs active:scale-95 shrink-0 ${
              credits >= 50
                ? (isDarkMode ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]' : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100')
                : credits >= 25
                ? (isDarkMode ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.2)]' : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100')
                : (isDarkMode ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.2)]' : 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100')
            }`}
            title={`Remaining Daily Credits: ${credits}/100 (⚡ 50/Lesson, 25/Magic Lens, 10/Search)`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
            <span className="font-mono font-black text-xs">{credits}</span>
            <span className="hidden sm:inline text-[10px] font-semibold opacity-70">/ 100</span>
          </button>

          {/* Saved Content Button (Magic Lens, AI Search, Lessons) */}
          <button 
            onClick={() => setIsSavedDrawerOpen(true)}
            className={`py-1 px-2 sm:px-2.5 md:px-3 rounded-full border transition-all flex items-center gap-1 sm:gap-1.5 font-bold text-xs shrink-0 ${
              savedLessons && savedLessons.length > 0 
                ? (isDarkMode ? 'border-amber-400/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 shadow-[0_0_12px_rgba(251,191,36,0.2)]' : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-sm')
                : (isDarkMode ? 'border-white/10 hover:bg-white/10 text-white' : 'border-slate-300 hover:bg-slate-100 text-slate-800')
            }`}
            title="Saved Content (Magic Lens, AI Search, Lessons)"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400 fill-amber-400/40 shrink-0" />
            <span className="hidden sm:inline font-semibold">Saved</span>
            {savedLessons && savedLessons.length > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none shrink-0">
                {savedLessons.length}
              </span>
            )}
          </button>

          {/* Theme Toggle Button */}
          <button 
            onClick={toggleTheme} 
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
              isDarkMode ? 'border-white/10 hover:bg-white/10 text-white' : 'border-slate-300 hover:bg-slate-100 text-slate-800'
            }`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
          </button>
          
          {/* Profile / Auth Button */}
          {currentUser ? (
            <button 
              onClick={() => setIsProfileOpen(true)}
              className={`p-1 sm:p-1.5 px-1.5 sm:px-2.5 rounded-full border transition-all flex items-center gap-1.5 font-bold text-xs shrink-0 ${
                isDarkMode ? 'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-white' : 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-slate-800'
              }`}
              title="Student Profile"
            >
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="Avatar" className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : <User className="w-3 h-3" />}
                </div>
              )}
              <span className="hidden md:inline max-w-[70px] truncate">{currentUser.displayName || 'Profile'}</span>
            </button>
          ) : (
            <button 
              onClick={() => openAuthModal("Sign in to unlock interactive lessons and 100 free daily credits.")}
              className="py-1 px-2.5 sm:px-3.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-1 shrink-0"
              title="Sign In"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs">Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-[10] flex-1 flex flex-col items-center px-4 sm:px-6 md:px-8 pt-20 sm:pt-28 md:pt-32 pb-14 sm:pb-20 w-full max-w-7xl mx-auto">
        
        {/* Giant Glowing Logo Area with Fresh Modern Styling */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative mb-2 flex flex-col items-center justify-center w-full mt-2 sm:mt-6"
        >
          {/* Ambient Glowing Halo */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[500px] h-[150px] sm:h-[180px] bg-gradient-to-r from-blue-500/20 via-indigo-500/25 to-cyan-500/20 blur-[100px] pointer-events-none rounded-full" />

          {/* 3D AI Teacher Mascot - Primary Hero Visual */}
          <AIMascotHero isDarkMode={isDarkMode} className="mb-2 sm:mb-4" />

          <h2 className={`text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b relative flex items-center justify-center gap-2 md:gap-4 drop-shadow-sm ${isDarkMode ? 'from-white via-blue-200 to-indigo-400' : 'from-blue-600 via-blue-800 to-indigo-950'}`}>
            ClassroomLM
          </h2>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex flex-col items-center w-full"
        >
          <p className={`mt-3 sm:mt-5 mb-8 sm:mb-10 text-sm sm:text-base md:text-xl font-medium max-w-2xl text-center px-3 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Step into a live, interactive learning environment. A dedicated AI teacher awaits to explain complex topics visually.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 sm:mb-12">
            <button 
              onClick={() => {
                if (!currentUser) {
                  openAuthModal("Sign in required to create interactive lessons.");
                  return;
                }
                setIsModalOpen(true);
              }}
              className="px-8 sm:px-10 py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-full font-black text-base sm:text-lg shadow-[0_0_35px_rgba(37,99,235,0.45)] hover:shadow-[0_0_55px_rgba(37,99,235,0.65)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 sm:gap-3 border border-white/25 group"
            >
              <Presentation className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Create Custom Classroom
            </button>
          </div>
        </motion.div>
        
        {/* Animated Feature Cards - Fresh Look with Compact Responsive Styling */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 relative z-10 mt-6 sm:mt-10 mb-12 sm:mb-16">
          {[
            {
              icon: "👨‍🏫",
              badge: "Real-Time 2D Teacher",
              title: "Real-Time 2D Teacher",
              desc: "Experience animated interactive lectures with expressive 2D character teaching, dynamic chalkboard illustrations, and zero latency.",
              iconStyle: isDarkMode 
                ? "bg-gradient-to-tr from-blue-600/25 via-indigo-600/30 to-cyan-500/25 border-blue-400/50 text-blue-300 shadow-[0_0_25px_rgba(59,130,246,0.35)] group-hover:rotate-3"
                : "bg-gradient-to-tr from-blue-100 via-indigo-50 to-cyan-100 border-2 border-blue-300/80 text-blue-900 shadow-sm group-hover:rotate-3",
              badgeStyle: isDarkMode 
                ? "bg-blue-500/15 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(34,211,238,0.25)] font-black"
                : "bg-blue-100 text-blue-900 border-2 border-blue-300/80 font-black shadow-sm"
            },
            {
              icon: "🎨",
              badge: "DYNAMIC NOTES",
              title: "Smart Chalkboard",
              desc: "Watch concepts come alive step-by-step with visual diagrams and dynamic notes.",
              iconStyle: isDarkMode 
                ? "bg-gradient-to-tr from-emerald-600/25 via-teal-600/30 to-cyan-500/25 border-emerald-400/50 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.35)] group-hover:-rotate-3"
                : "bg-gradient-to-tr from-emerald-100 via-teal-50 to-cyan-100 border-2 border-emerald-300/80 text-emerald-900 shadow-sm group-hover:-rotate-3",
              badgeStyle: isDarkMode 
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                : "bg-emerald-100 text-emerald-900 border-2 border-emerald-300/80 font-black shadow-sm"
            },
            {
              icon: "💬",
              badge: "TWO-WAY SPEECH",
              title: "Instant Q&A",
              desc: "Ask follow-up questions anytime without breaking your live lesson immersion.",
              iconStyle: isDarkMode 
                ? "bg-gradient-to-tr from-purple-600/25 via-pink-600/30 to-indigo-500/25 border-purple-400/50 text-purple-300 shadow-[0_0_25px_rgba(168,85,247,0.35)] group-hover:rotate-3"
                : "bg-gradient-to-tr from-purple-100 via-pink-50 to-indigo-100 border-2 border-purple-300/80 text-purple-900 shadow-sm group-hover:rotate-3",
              badgeStyle: isDarkMode 
                ? "bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                : "bg-purple-100 text-purple-900 border-2 border-purple-300/80 font-black shadow-sm"
            }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className={`p-6 sm:p-7 rounded-3xl backdrop-blur-2xl border flex flex-col gap-3.5 sm:gap-4 group hover:-translate-y-2 transition-all duration-300 shadow-xl ${isDarkMode ? 'bg-slate-900/65 border-white/10 hover:border-blue-500/40 hover:shadow-[0_20px_40px_-15px_rgba(30,58,138,0.35)]' : 'bg-white/95 border-2 border-slate-200/90 hover:border-blue-400/60 shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)]'}`}
            >
              <div className="flex items-center justify-between">
                {/* Selected element: feature card icon container */}
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-xl sm:text-2xl border transition-all duration-300 group-hover:scale-110 shrink-0 shadow-lg ${feature.iconStyle}`}>
                  {feature.icon}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${feature.badgeStyle}`}>
                  {feature.badge}
                </span>
              </div>
              <h3 className={`text-lg sm:text-xl font-black tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{feature.title}</h3>
              <p className={`text-xs sm:text-sm leading-relaxed font-normal ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Professional Footer */}
      <footer className={`relative z-[10] w-full border-t backdrop-blur-xl mt-auto transition-colors duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/60' : 'border-slate-200/80 bg-white/60'}`}>
        <div className={`max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          <div>
            © 2026 ClassroomLM. Free AI Learning Tool.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <button onClick={() => setLegalContent("about-us")} className={`transition-colors ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-900'}`}>About Us</button>
            <button onClick={() => setLegalContent("privacy-policy")} className={`transition-colors ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-900'}`}>Privacy Policy</button>
            <button onClick={() => setLegalContent("terms-of-service")} className={`transition-colors ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-900'}`}>Terms of Service</button>
            <button onClick={() => setLegalContent("ai-disclaimer")} className={`transition-colors ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-900'}`}>AI Disclaimer</button>
          </div>
        </div>
      </footer>

      {/* Hidden File Input for Device Gallery Photo Upload */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />

      {/* Pie / Radial Menu with "Colorful Spark" (Gemini Icon) for Magic Lens, AI Search & Free Calculator */}
      <RadialMenu 
        onOpenMagicLensCamera={() => {
          if (!currentUser) {
            openAuthModal("Sign in required to use Magic Lens visual problem solver.");
            return;
          }
          setMagicLensState('camera');
        }}
        onOpenMagicLensUpload={() => {
          if (!currentUser) {
            openAuthModal("Sign in required to use Magic Lens visual problem solver.");
            return;
          }
          fileInputRef.current?.click();
        }}
        onOpenSearch={() => {
          if (!currentUser) {
            openAuthModal("Sign in required to use AI Search.");
            return;
          }
          setIsSearchOpen(true);
        }}
        onOpenCalculator={() => {
          // 100% Free of credits & never saved to Saved Content
          setIsCalculatorOpen(true);
        }}
        isDarkMode={isDarkMode}
      />

      {/* Smart Student Calculator (Free of credits, session-only, not saved in Saved Content) */}
      <SmartCalculator 
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        isDarkMode={isDarkMode}
      />

      {/* Magic Lens Camera View */}
      {magicLensState === 'camera' && (
        <CameraCapture 
          onCapture={(dataUrl) => {
            handleImageSelect(dataUrl);
          }}
          onClose={() => setMagicLensState('idle')}
        />
      )}

      {/* Magic Lens Crop View */}
      {magicLensState === 'crop' && magicLensImage && (
        <MagicLensCrop 
          imageUrl={magicLensImage}
          onComplete={processImage}
          onClose={() => setMagicLensState('idle')}
        />
      )}

      {/* Magic Lens Processing / Result Modal */}
      <AnimatePresence>
        {(magicLensState === 'processing' || magicLensState === 'result') && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className={`w-full ${isMagicFullScreen ? 'h-[100dvh] max-w-none rounded-none' : 'max-w-2xl rounded-2xl sm:rounded-3xl max-h-[92dvh]'} p-4 sm:p-6 md:p-8 shadow-[0_0_40px_rgba(59,130,246,0.3)] border relative flex flex-col items-center overflow-hidden transition-all ${isDarkMode ? 'bg-slate-900 border-blue-500/30' : 'bg-white border-blue-200'}`}
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500" />
              
              <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex items-center gap-1.5 sm:gap-2 z-10">
                {magicLensState === 'result' && (
                  <button 
                    onClick={() => setIsMagicFullScreen(!isMagicFullScreen)} 
                    className={`opacity-70 hover:opacity-100 transition-opacity p-1.5 sm:p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                  >
                    {isMagicFullScreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                )}
                <button 
                  onClick={() => {
                    setMagicLensState('idle');
                    setIsMagicFullScreen(false);
                    setIsMagicSaved(false);
                  }} 
                  className="opacity-70 hover:opacity-100 transition-opacity bg-red-500/10 text-red-500 p-1.5 sm:p-2 rounded-full hover:bg-red-500 hover:text-white"
                  title="Discard / Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
              
              {magicLensState === 'processing' ? (
                <div className="py-10 sm:py-14 flex flex-col items-center gap-5 sm:gap-6">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20">
                    <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                    <Wand2 className="absolute inset-0 m-auto w-7 h-7 sm:w-8 sm:h-8 text-blue-500 animate-pulse" />
                  </div>
                  <h3 className={`text-lg sm:text-xl font-bold tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Analyzing Visual...</h3>
                  <p className={`text-xs sm:text-sm text-center px-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Identifying problem and formulating crystal-clear solution.</p>
                </div>
              ) : (
                <div className={`w-full pt-2 sm:pt-4 flex flex-col ${isMagicFullScreen ? 'flex-1 min-h-0' : ''}`}>
                  <div className="flex items-center gap-2 mb-3 sm:mb-5">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 shrink-0" />
                    <h3 className={`text-lg sm:text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Magic Solution</h3>
                  </div>
                  <div className={`rounded-2xl p-3.5 sm:p-5 border shadow-inner overflow-y-auto overflow-x-auto prose prose-slate dark:prose-invert max-w-none ${isMagicFullScreen ? 'flex-1 min-h-0' : 'max-h-[55vh] sm:max-h-[60vh]'} ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <Markdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        pre({ children }) {
                          return <div className="not-prose my-3 overflow-x-auto max-w-full rounded-xl">{children}</div>;
                        },
                        code(props) {
                          const { children, className, node, ref, ...rest } = props as any;
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          if (match && match[1] === 'mermaid') {
                            return <MermaidDiagram chart={codeString} />;
                          }
                          if (match) {
                            return (
                              <SyntaxHighlighter
                                {...rest}
                                PreTag="div"
                                children={codeString}
                                language={match[1]}
                                style={vscDarkPlus}
                              />
                            );
                          }
                          return (
                            <code ref={ref} {...rest} className={className || "font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs sm:text-sm text-pink-600 dark:text-pink-400 font-semibold"}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {magicResult}
                    </Markdown>
                  </div>

                  {/* Actions Footer: Discard vs Save to Content */}
                  <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 w-full border-t border-slate-700/40 pt-3.5 sm:pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        // Discard: close without saving
                        setMagicLensState('idle');
                        setIsMagicFullScreen(false);
                        setIsMagicSaved(false);
                      }}
                      className={`w-full sm:w-auto px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                        isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      }`}
                      title="Discard capture without saving"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span>Discard</span>
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {isMagicSaved ? (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-xl">
                          <Check className="w-4 h-4" />
                          Saved to Saved Content
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSaveMagicLens && magicResult) {
                              onSaveMagicLens(magicResult, magicPrompt);
                            }
                            setIsMagicSaved(true);
                          }}
                          className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] active:scale-95"
                          title="Save this solution to your Saved Content"
                        >
                          <Bookmark className="w-4 h-4" />
                          <span>Save to Content</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setMagicLensState('idle');
                          setIsMagicFullScreen(false);
                        }}
                        className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl transition-all active:scale-95"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Configuration Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className={`w-full max-w-lg rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] border relative ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              <button onClick={() => setIsModalOpen(false)} className={`absolute top-6 right-6 opacity-50 hover:opacity-100 transition-opacity p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'}`}>
                <X className="w-5 h-5" />
              </button>
              
              <h3 className={`text-2xl font-black mb-6 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Generate Classroom</h3>
              
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
                <div>
                  <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    What do you want to learn?
                  </label>
                  <input 
                    type="text" 
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder={modalUploadedFile ? `Selected: ${modalUploadedFile.name} (Topic optional)` : "e.g. How black holes work"} 
                    className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'}`}
                    autoFocus
                  />
                </div>

                {/* PDF & Image Upload Input (Topic optional if uploaded) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`block text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Or Upload Study Material (PDF or Image)
                    </label>
                    <span className="text-[11px] font-semibold text-cyan-400">
                      Topic optional with upload
                    </span>
                  </div>

                  <input 
                    type="file" 
                    ref={pdfInputRef} 
                    accept="application/pdf" 
                    onChange={e => handleModalFileUpload(e, 'pdf')} 
                    className="hidden" 
                  />
                  <input 
                    type="file" 
                    ref={imageInputRef} 
                    accept="image/*" 
                    onChange={e => handleModalFileUpload(e, 'image')} 
                    className="hidden" 
                  />

                  {modalUploadedFile ? (
                    <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                      isDarkMode ? 'bg-slate-950/80 border-cyan-500/40 text-white' : 'bg-cyan-50/70 border-cyan-300 text-slate-900'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        {modalUploadedFile.previewUrl ? (
                          <img 
                            src={modalUploadedFile.previewUrl} 
                            alt="Preview" 
                            className="w-10 h-10 rounded-xl object-cover border border-cyan-400/50 shrink-0" 
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{modalUploadedFile.name}</p>
                          <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {(modalUploadedFile.size / 1024).toFixed(1)} KB • {modalUploadedFile.type.includes('pdf') ? 'PDF Document' : 'Image'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalUploadedFile(null)}
                        className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors shrink-0"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-95 group ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 hover:border-red-500/50 hover:bg-red-950/20 text-slate-300 hover:text-white' 
                            : 'bg-slate-50 border-slate-200 hover:border-red-400 hover:bg-red-50 text-slate-700 hover:text-red-900'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                        <span>Upload PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-95 group ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 hover:border-blue-500/50 hover:bg-blue-950/20 text-slate-300 hover:text-white' 
                            : 'bg-slate-50 border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 hover:text-blue-900'
                        }`}
                      >
                        <ImageIcon className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                        <span>Upload Image</span>
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-bold mb-2 flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      <GraduationCap className="w-4 h-4" /> Class
                    </label>
                    <div className="relative">
                      <select
                        value={classLevel}
                        onChange={e => setClassLevel(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                      >
                        {[...Array(12)].map((_, i) => (
                          <option key={i + 1} value={`Class ${i + 1}`}>Class {i + 1}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                        <ChevronRight className="w-4 h-4 rotate-90 opacity-50" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold mb-2 flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      <Globe className="w-4 h-4" /> Language
                    </label>
                    <div className="relative">
                      <select
                        value={language}
                        onChange={e => setLanguage(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                      >
                        {['English', 'Telugu', 'Spanish', 'French', 'German', 'Hindi', 'Japanese', 'Mandarin'].map(lang => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                        <ChevronRight className="w-4 h-4 rotate-90 opacity-50" />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className={`block text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Teacher Persona</label>
                  <div className="grid grid-cols-2 gap-2">
                    {personas.map(p => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPersona(p)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-all ${persona === p ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Focus Areas</label>
                  <div className="flex flex-wrap gap-2">
                    {focusTags.map(tag => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleFocus(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${focusArea.includes(tag) ? 'bg-orange-500 text-white border-orange-400' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200')}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Google reCAPTCHA Protection Badge */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 text-slate-400' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Protected by <strong className="font-semibold text-blue-500">Google reCAPTCHA</strong></span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                </div>

                <button 
                  type="submit"
                  disabled={!topic.trim() && !modalUploadedFile}
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
                >
                  <Presentation className="w-5 h-5" />
                  Generate Classroom {modalUploadedFile ? `from ${modalUploadedFile.type.includes('pdf') ? 'PDF' : 'Image'}` : ''}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className={`w-full ${isSearchFullScreen ? 'h-[100dvh] max-w-none rounded-none' : 'max-w-3xl rounded-2xl sm:rounded-3xl max-h-[92dvh]'} p-4 sm:p-6 md:p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] border relative flex flex-col transition-all overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]" />

              <div className="absolute top-4 sm:top-6 right-4 sm:right-6 flex items-center gap-1.5 sm:gap-2 z-10">
                {searchState === 'result' && (
                  <button 
                    onClick={() => setIsSearchFullScreen(!isSearchFullScreen)}
                    className={`opacity-70 hover:opacity-100 transition-opacity p-1.5 sm:p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                  >
                    {isSearchFullScreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchState('idle');
                    setSearchQuery('');
                    setSearchResult('');
                    setIsSearchFullScreen(false);
                  }} 
                  className={`opacity-70 hover:opacity-100 transition-opacity p-1.5 sm:p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2.5 mb-1 sm:mb-2 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                  <Search className="w-4 h-4 text-white" />
                </div>
                <h2 className={`text-xl sm:text-2xl font-black flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  AI Search
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  10⚡ CREDITS
                </span>
              </div>
              <p className={`mb-4 sm:mb-5 text-xs sm:text-sm font-medium shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Instant comprehensive AI solutions, derivations, and step-by-step guidance.
              </p>

              {searchState === 'idle' && (
                <div className="flex flex-col gap-3.5">
                  <form onSubmit={handleSearchSubmit} className="relative flex items-center shrink-0">
                    <Search className={`absolute left-3.5 sm:left-4 w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search any concept, formula, or question..." 
                      className={`w-full pl-10 sm:pl-12 pr-24 sm:pr-28 py-3.5 sm:py-4 rounded-2xl border text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDarkMode ? 'bg-slate-950/80 border-slate-700/80 text-white placeholder:text-slate-500 shadow-inner' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'}`}
                      autoFocus
                    />
                    <button 
                      type="submit" 
                      disabled={!searchQuery.trim()}
                      className="absolute right-1.5 sm:right-2 px-4 sm:px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                      <span>Search</span>
                      <span className="text-[10px] opacity-75 font-mono hidden sm:inline">↵</span>
                    </button>
                  </form>

                  {/* Quick Topics */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                    <span className="text-[11px] font-bold text-slate-400 shrink-0">Quick topics:</span>
                    {[
                      "⚡ Quantum Mechanics",
                      "🧬 CRISPR Cas9",
                      "📐 Calculus Integrals",
                      "🌌 Special Relativity",
                      "🧪 Periodic Trends"
                    ].map((topicChip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSearchQuery(topicChip.replace(/^[^\w]+/, ''));
                        }}
                        className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border active:scale-95 ${
                          isDarkMode 
                            ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700' 
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                        }`}
                      >
                        {topicChip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchState === 'generating' && (
                <div className="flex flex-col items-center justify-center py-10 sm:py-14 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className={`text-base sm:text-lg font-bold animate-pulse ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    AI is thinking...
                  </p>
                </div>
              )}

              {searchState === 'result' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-3 sm:mt-4 flex flex-col ${isSearchFullScreen ? 'flex-1 min-h-0' : ''}`}>
                  <div className={`p-4 sm:p-6 rounded-2xl overflow-y-auto overflow-x-auto prose prose-slate dark:prose-invert max-w-none ${isSearchFullScreen ? 'flex-1 min-h-0' : 'max-h-[55vh] sm:max-h-[60vh]'} ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <Markdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        pre({ children }) {
                          return <div className="not-prose my-3 overflow-x-auto max-w-full rounded-xl">{children}</div>;
                        },
                        code(props) {
                          const { children, className, node, ref, ...rest } = props as any;
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          if (match && match[1] === 'mermaid') {
                            return <MermaidDiagram chart={codeString} />;
                          }
                          if (match) {
                            return (
                              <SyntaxHighlighter
                                {...rest}
                                PreTag="div"
                                children={codeString}
                                language={match[1]}
                                style={vscDarkPlus}
                              />
                            );
                          }
                          return (
                            <code ref={ref} {...rest} className={className || "font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs sm:text-sm text-pink-600 dark:text-pink-400 font-semibold"}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {searchResult}
                    </Markdown>
                  </div>
                  <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-end items-center gap-2.5 sm:gap-3">
                    <button 
                      onClick={() => setSearchState('idle')} 
                      className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      Search Again
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined') {
                          navigator.clipboard.writeText(searchResult);
                        }
                      }}
                      className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all border ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                    >
                      Copy Solution
                    </button>
                    <button 
                      onClick={handleSaveSearchResult} 
                      className="px-5 sm:px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Sparkles className="w-4 h-4 text-yellow-300" /> Save to Saved Content
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legal Modal */}
      <AnimatePresence>
        {legalContent && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className={`w-full max-w-2xl rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] border relative max-h-[80vh] overflow-y-auto ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              <button onClick={() => setLegalContent(null)} className={`absolute top-6 right-6 opacity-50 hover:opacity-100 transition-opacity p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'}`}>
                <X className="w-5 h-5" />
              </button>
              
              <h3 className={`text-2xl font-black mb-6 capitalize ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{legalContent.replace('-', ' ')}</h3>
              
              <div className={`leading-relaxed text-sm space-y-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                {legalContent === 'about-us' && (
                  <p>ClassroomLM is an experimental learning platform powered by AI. Our mission is to make learning interactive and engaging through virtual classrooms and intelligent avatars.</p>
                )}
                {legalContent === 'privacy-policy' && (
                  <>
                    <p>We value your privacy. We do not sell your personal data. Any data collected is used solely to improve the ClassroomLM experience.</p>
                    <p>When you use the AI features, your queries are processed by external AI models.</p>
                  </>
                )}
                {legalContent === 'terms-of-service' && (
                  <>
                    <p>By using ClassroomLM, you agree to our Terms of Service. This platform is provided "as is" without warranties of any kind.</p>
                  </>
                )}
                {legalContent === 'ai-disclaimer' && (
                  <>
                    <p>The content generated by ClassroomLM is powered by Artificial Intelligence. While we strive for accuracy, AI models can occasionally produce incorrect, biased, or incomplete information.</p>
                    <p>Always verify important information with trusted sources.</p>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Content Drawer / Modal */}
      <AnimatePresence>
        {isSavedDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-end sm:p-4 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setIsSavedDrawerOpen(false)}
          >
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md h-full sm:h-[92vh] sm:rounded-3xl border flex flex-col shadow-2xl overflow-hidden ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Drawer Header */}
              <div className={`p-5 border-b flex items-center justify-between shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Bookmark className="w-5 h-5 fill-amber-400/40" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg leading-tight">Saved Content</h3>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {savedLessons.length} {savedLessons.length === 1 ? 'item' : 'items'} saved
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSavedDrawerOpen(false)}
                  className={`p-2 rounded-full transition-colors ${
                    isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                  }`}
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Pills */}
              <div className={`p-3 border-b flex items-center gap-1.5 shrink-0 overflow-x-auto scrollbar-hide ${isDarkMode ? 'border-slate-800/80 bg-slate-950/40' : 'border-slate-100 bg-slate-50'}`}>
                {[
                  { id: 'all', label: 'All', count: savedLessons.length },
                  { id: 'lessons', label: 'Lessons', count: savedLessons.filter(l => !l.isMagicLens && !l.isAISearch).length, icon: BookOpen },
                  { id: 'magic', label: 'Magic Lens', count: savedLessons.filter(l => l.isMagicLens).length, icon: Wand2 },
                  { id: 'search', label: 'AI Search', count: savedLessons.filter(l => l.isAISearch).length, icon: Search }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = savedFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSavedFilter(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isDarkMode
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      <span>{tab.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/25 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredSavedItems.length > 0 ? (
                  filteredSavedItems.map((item) => {
                    const isMagic = Boolean(item.isMagicLens);
                    const isSearch = Boolean(item.isAISearch);
                    const isLesson = !isMagic && !isSearch;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleOpenSavedItem(item)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col gap-2 relative ${
                          isDarkMode
                            ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 hover:border-blue-500/50 shadow-sm'
                            : 'bg-white hover:bg-blue-50/40 border-slate-200 hover:border-blue-300 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Type Icon */}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                              isMagic 
                                ? 'bg-gradient-to-tr from-purple-500 to-pink-500 text-white' 
                                : isSearch 
                                  ? 'bg-gradient-to-tr from-cyan-500 to-blue-500 text-white' 
                                  : 'bg-gradient-to-tr from-amber-500 to-indigo-600 text-white'
                            }`}>
                              {isMagic ? <Wand2 className="w-4 h-4" /> : isSearch ? <Search className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isMagic 
                                    ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' 
                                    : isSearch 
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {isMagic ? 'Magic Lens' : isSearch ? 'AI Search' : 'Lesson'}
                                </span>
                              </div>
                              <h4 className="font-bold text-sm md:text-base leading-snug truncate group-hover:text-blue-400 transition-colors">
                                {item.title || (isMagic ? "Visual Analysis" : isSearch ? "AI Search" : "Interactive Lesson")}
                              </h4>
                            </div>
                          </div>

                          {/* Delete Button */}
                          {onDeleteLesson && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteLesson(item.id);
                              }}
                              className={`p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-all ${
                                isDarkMode ? 'hover:bg-red-500/20 hover:text-red-400 text-slate-400' : 'hover:bg-red-50 hover:text-red-600 text-slate-400'
                              }`}
                              title="Delete from saved"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Description */}
                        {item.description && (
                          <p className={`text-xs line-clamp-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {item.description}
                          </p>
                        )}

                        {/* Open Action Footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-700/40 text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                          <span>{isLesson ? "Launch Classroom" : "View Result"}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  /* Empty State */
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20">
                      <Bookmark className="w-8 h-8 opacity-60" />
                    </div>
                    <h4 className="font-bold text-base mb-1">No Saved Content Found</h4>
                    <p className={`text-xs max-w-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {savedFilter === 'all'
                        ? "Save visual captures with Magic Lens, deep solutions from AI Search, or generated classrooms to view them anytime!"
                        : `No ${savedFilter === 'lessons' ? 'lessons' : savedFilter === 'magic' ? 'Magic Lens captures' : 'AI Searches'} saved yet.`}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileOpen && (
          <ProfileModal 
            isDarkMode={isDarkMode} 
            onClose={() => setIsProfileOpen(false)} 
            classLevel={classLevel}
            setClassLevel={setClassLevel}
            language={language}
            setLanguage={setLanguage}
          />
        )}
      </AnimatePresence>

      {/* Insufficient Credit Alert Modal */}
      <AnimatePresence>
        {creditAlert && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreditAlert(null)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`relative w-full max-w-md rounded-3xl p-6 shadow-2xl border z-10 flex flex-col items-center text-center ${
                isDarkMode ? 'bg-slate-900 border-amber-500/40 text-white' : 'bg-white border-amber-300 text-slate-900'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/30">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black mb-2">Insufficient Daily Credits</h3>
              <p className={`text-sm leading-relaxed mb-6 font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {creditAlert}
              </p>
              <button
                onClick={() => setCreditAlert(null)}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl transition-all shadow-lg active:scale-95 text-sm"
              >
                Understood
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Strict Authentication Gated Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        reason={authModalReason}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
