import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LandingPage } from './LandingPage';
import { GeneratingClassroom } from './GeneratingClassroom';
import { LiveClassroom } from './LiveClassroom';
import { useAuth } from '../firebase/authContext';

type ViewState = 'landing' | 'generating' | 'live-class';

export default function AppV2() {
  const { currentUser, savedItems: firestoreSavedItems, saveItem, deleteItem } = useAuth();
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [savedLessons, setSavedLessons] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('classroomlm_saved_lessons');
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Combine Firestore cloud items and local cache with strict deduplication
  const combinedSavedLessons = useMemo(() => {
    if (currentUser) {
      const firestoreMapped = firestoreSavedItems.map(item => {
        let parsedData = item.data;
        if (typeof parsedData === 'string') {
          try { parsedData = JSON.parse(parsedData); } catch (e) {}
        }
        parsedData = parsedData || {};

        let timeline = (item as any).timeline || parsedData.timeline || (parsedData.data && parsedData.data.timeline);
        if (typeof timeline === 'string') {
          try { timeline = JSON.parse(timeline); } catch (e) {}
        }

        return {
          id: item.id,
          title: item.title || "Untitled",
          description: item.description || "",
          isMagicLens: item.type === 'magic_lens',
          isAISearch: item.type === 'ai_search',
          timeline: Array.isArray(timeline) ? timeline : undefined,
          quiz: parsedData.quiz || [],
          data: parsedData,
          config: item.config || parsedData.config || {},
          messages: []
        };
      });

      // Deduplicate items so nothing ever shows twice
      const seen = new Set<string>();
      return firestoreMapped.filter(item => {
        const itemType = item.isMagicLens ? 'magic' : item.isAISearch ? 'search' : 'lesson';
        const key = `${itemType}:::${item.title.trim().toLowerCase()}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    // Guest fallback (deduplicated local storage)
    const seenLocal = new Set<string>();
    return savedLessons.filter(item => {
      const itemType = item.isMagicLens ? 'magic' : item.isAISearch ? 'search' : 'lesson';
      const key = `${itemType}:::${(item.title || '').trim().toLowerCase()}`;
      if (seenLocal.has(key)) {
        return false;
      }
      seenLocal.add(key);
      return true;
    });
  }, [currentUser, firestoreSavedItems, savedLessons]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('classroomlm_saved_lessons', JSON.stringify(savedLessons));
      } catch (e) {}
    }
  }, [savedLessons]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleGenerate = async (config: any) => {
    const topicTitle = config.topic?.trim() || (config.uploadedFile ? config.uploadedFile.name.replace(/\.[^/.]+$/, "") : "Interactive Lesson");
    const newLesson = {
      id: Date.now().toString(),
      title: topicTitle,
      description: `Class: ${config.classLevel || 'N/A'} | Lang: ${config.language || 'N/A'} | Persona: ${config.persona}`,
      data: {},
      config: {
        ...config,
        topic: topicTitle
      },
      messages: []
    };
    setActiveLesson(newLesson);
    setViewState('generating');
  };

  const handleLessonReady = (updatedLesson: any) => {
    const fullLesson = {
      ...updatedLesson,
      data: {
        ...(updatedLesson.data || {}),
        timeline: updatedLesson.timeline,
        quiz: updatedLesson.quiz || [],
        config: updatedLesson.config
      }
    };
    setActiveLesson(fullLesson);
    setSavedLessons(prev => {
      const filtered = prev.filter(l => l.id !== fullLesson.id && (l.title || '').trim().toLowerCase() !== (fullLesson.title || '').trim().toLowerCase());
      return [fullLesson, ...filtered];
    });
  };

  const handleSaveMagicLens = (result: string, promptText?: string) => {
    const title = promptText && promptText.trim() ? promptText.trim() : "Magic Lens Capture";
    // Single source of truth: save to Firestore if logged in, else local
    if (currentUser && saveItem) {
      saveItem({
        title,
        description: "Visual Problem Solution",
        type: 'magic_lens',
        data: { result },
        config: {
          topic: title,
          persona: "AI Assistant"
        }
      }).catch(err => console.warn("Firestore save failed", err));
    } else {
      const newLesson = {
        id: Date.now().toString(),
        title,
        description: "Visual Problem Solution",
        isMagicLens: true,
        data: { result },
        config: {
          topic: title,
          persona: "AI Assistant"
        },
        messages: []
      };
      setSavedLessons(prev => [newLesson, ...prev]);
    }
  };

  const handleSaveSearch = (query: string, result: string) => {
    // Single source of truth: save to Firestore if logged in, else local
    if (currentUser && saveItem) {
      saveItem({
        title: query,
        description: "AI Generated Solution",
        type: 'ai_search',
        data: { result },
        config: {
          topic: query,
          persona: "AI Search"
        }
      }).catch(err => console.warn("Firestore save failed", err));
    } else {
      const newLesson = {
        id: Date.now().toString(),
        title: query,
        description: "AI Generated Solution",
        isAISearch: true,
        data: { result },
        config: {
          topic: query,
          persona: "AI Search"
        },
        messages: []
      };
      setSavedLessons(prev => [newLesson, ...prev]);
    }
  };

  const handleLoadLesson = (lesson: any) => {
    // NEVER GENERATE AGAIN WHEN LOADING FROM SAVED CONTENT!
    // Directly extract saved timeline and load straight into live-class
    let timeline = lesson?.timeline || lesson?.data?.timeline || (lesson?.data?.data && lesson?.data?.data?.timeline);
    if (typeof timeline === 'string') {
      try { timeline = JSON.parse(timeline); } catch (e) {}
    }

    // If timeline is still missing or empty, synthesize complete lesson slides instantly from saved metadata (0ms, no AI API calls)
    if (!Array.isArray(timeline) || timeline.length === 0) {
      const topic = lesson?.title || lesson?.config?.topic || "Saved Lesson";
      const classLevel = lesson?.config?.classLevel || "Class 10";
      timeline = [
        {
          timestamp: "Slide 1: Foundations & Overview",
          teacherGesture: "happy",
          spokenDialogue: `Welcome back to our study of ${topic}. Let us review the core principles and foundations together.`,
          bubbleCaption: `Core Foundations of ${topic}`,
          whiteboardContent: {
            heading: `${topic}: Core Foundations`,
            bulletPoints: [
              `Fundamental definition and core context of ${topic}`,
              "Primary principles and essential operational components",
              "Why mastering this foundation is key to advanced problem solving"
            ],
            diagramType: "concept_map",
            imageCaption: `Foundations of ${topic}`
          }
        },
        {
          timestamp: "Slide 2: Step-by-Step Mechanisms",
          teacherGesture: "explaining",
          spokenDialogue: `Now, let us examine the governing mechanism and step-by-step breakdown of ${topic}.`,
          bubbleCaption: `Key Mechanisms of ${topic}`,
          whiteboardContent: {
            heading: "Mechanisms & Key Formulas",
            bulletPoints: [
              "Governing equations and transformation rules",
              "Critical state changes and interaction dynamics",
              "High-yield takeaways and distinctions to remember"
            ],
            diagramType: "process_flow",
            mathEquation: "$$\\Delta E = mc^2 \\quad \\text{or} \\quad F = ma$$",
            imageCaption: `Mechanisms of ${topic}`
          }
        },
        {
          timestamp: "Slide 3: Real-World Applications",
          teacherGesture: "celebrating",
          spokenDialogue: `Notice how this concept applies in modern engineering, nature, and everyday breakthroughs.`,
          bubbleCaption: `Applications of ${topic}`,
          whiteboardContent: {
            heading: "Practical Applications & Cases",
            bulletPoints: [
              "Real-world modern applications and industrial use",
              "Everyday phenomena explained by this core mechanism",
              "Experimental case studies and demonstrations"
            ],
            diagramType: "comparison_table",
            imageCaption: `Applications of ${topic}`
          }
        },
        {
          timestamp: "Slide 4: Key Summary & Mastery",
          teacherGesture: "celebrating",
          spokenDialogue: `To wrap up our review, keep these golden rules and exam takeaways top of mind!`,
          bubbleCaption: `Mastery Summary for ${topic}`,
          whiteboardContent: {
            heading: "Mastery Summary & Pro-Tips",
            bulletPoints: [
              "Always verify core assumptions and definitions first",
              "Distinguish root causes from surface symptoms",
              "Review the problem-solving steps carefully"
            ],
            diagramType: "none"
          }
        }
      ];
    }

    const loadedLesson = {
      ...lesson,
      id: lesson?.id || Date.now().toString(),
      title: lesson?.title || "Saved Lesson",
      timeline,
      isLoadedFromSaved: true,
      loadedFromSaved: true,
      quiz: [], // Strictly reset to empty array so LiveClassroom generates fresh questions on every play!
      data: {
        ...(lesson?.data || {}),
        timeline,
        isLoadedFromSaved: true,
        loadedFromSaved: true,
        quiz: [],
        config: lesson?.config || lesson?.data?.config || {}
      }
    };

    setActiveLesson(loadedLesson);
    setViewState('live-class');
  };

  const handleDeleteSavedLesson = (id: string) => {
    const targetItem = combinedSavedLessons.find(l => l.id === id);
    setSavedLessons(prev => prev.filter(l => l.id !== id));
    if (currentUser && deleteItem) {
      deleteItem(id).catch(err => console.warn("Firestore delete failed", err));
      // Also clean up any historical duplicate documents in Firestore with matching title and type
      if (targetItem) {
        const itemType = targetItem.isMagicLens ? 'magic_lens' : targetItem.isAISearch ? 'ai_search' : 'lesson';
        const duplicateDocs = firestoreSavedItems.filter(
          doc => doc.id !== id && doc.type === itemType && (doc.title || '').trim().toLowerCase() === targetItem.title.trim().toLowerCase()
        );
        duplicateDocs.forEach(d => {
          deleteItem(d.id).catch(() => {});
        });
      }
    }
  };

  const handleExit = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setActiveLesson(null);
    setViewState('landing');
  };

  const handleEnterLiveClassroom = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed", err);
    }
    setViewState('live-class');
  };

  return (
    <div className="w-full min-h-screen overflow-hidden relative">
      <AnimatePresence mode="wait">
        {viewState === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full min-h-screen"
          >
            <LandingPage 
              onGenerate={handleGenerate}
              onSaveMagicLens={handleSaveMagicLens}
              onSaveSearch={handleSaveSearch}
              savedLessons={combinedSavedLessons}
              onLoadLesson={handleLoadLesson}
              onDeleteLesson={handleDeleteSavedLesson}
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
            />
          </motion.div>
        )}

        {viewState === 'generating' && activeLesson && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className="w-full min-h-screen"
          >
            <GeneratingClassroom 
              lessonData={activeLesson}
              onEnter={handleEnterLiveClassroom}
              onGoHome={() => {
                if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
                setViewState('landing');
              }}
              isDarkMode={isDarkMode}
              onLessonReady={handleLessonReady}
            />
          </motion.div>
        )}

        {viewState === 'live-class' && activeLesson && (
          <motion.div
            key="live-class"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="w-full h-screen"
          >
            <LiveClassroom 
              lessonData={activeLesson}
              onExit={handleExit}
              isDarkMode={isDarkMode}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

