import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LandingPage } from './LandingPage';
import { GeneratingClassroom } from './GeneratingClassroom';
import { LiveClassroom } from './LiveClassroom';
import { useAuth, getUserSavedStorageKey } from '../firebase/authContext';
import { unlockAudio } from './audioManager';

import { photosynthesisLesson } from '../data/sampleLessons/photosynthesis';

type ViewState = 'landing' | 'generating' | 'live-class';

export default function AppV2() {
  const { currentUser, savedItems: firestoreSavedItems, saveItem, deleteItem } = useAuth();
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [savedLessons, setSavedLessons] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        // Wipe legacy shared unpartitioned key to eliminate cross-user data bleeding
        localStorage.removeItem('classroomlm_saved_lessons');
      } catch (e) {}
    }
    return [];
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Strictly reload user-scoped saved lessons whenever active user changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = getUserSavedStorageKey(currentUser?.uid);
        const stored = localStorage.getItem(key);
        setSavedLessons(stored ? JSON.parse(stored) : []);
      } catch (e) {
        setSavedLessons([]);
      }
    }
  }, [currentUser?.uid]);

  // Combine Firestore cloud items and user-scoped local cache with strict deduplication
  const combinedSavedLessons = useMemo(() => {
    const firestoreMapped = currentUser ? firestoreSavedItems.map(item => {
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
    }) : [];

    // Strictly user-isolated items: only combine Firestore items with local items belonging to THIS user
    const merged = currentUser 
      ? [...firestoreMapped, ...(savedLessons || [])]
      : [...(savedLessons || [])];

    // Deduplicate items so nothing ever shows twice
    const seen = new Set<string>();
    return merged.filter(item => {
      const itemType = item.isMagicLens ? 'magic' : item.isAISearch ? 'search' : 'lesson';
      const key = `${itemType}:::${(item.title || item.id || '').trim().toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [currentUser, firestoreSavedItems, savedLessons]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = getUserSavedStorageKey(currentUser?.uid);
        localStorage.setItem(key, JSON.stringify(savedLessons));
      } catch (e) {}
    }
  }, [savedLessons, currentUser?.uid]);

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
    unlockAudio();
    const topicTitle = config.topic?.trim() || (config.uploadedFile ? config.uploadedFile.name.replace(/\.[^/.]+$/, "") : "Interactive Lesson");
    const description = `Class: ${config.classLevel || 'N/A'} | Lang: ${config.language || 'N/A'} | Persona: ${config.persona || 'Friendly Mentor'}`;
    const newLesson = {
      id: Date.now().toString(),
      title: topicTitle,
      description,
      data: {
        config: {
          ...config,
          topic: topicTitle
        }
      },
      config: {
        ...config,
        topic: topicTitle
      },
      messages: []
    };
    setActiveLesson(newLesson);
    setViewState('generating');

    // Automatically and immediately save lesson to Saved Content even before generating!
    setSavedLessons(prev => {
      const filtered = prev.filter(l => l.id !== newLesson.id && (l.title || '').trim().toLowerCase() !== topicTitle.trim().toLowerCase());
      const updated = [newLesson, ...filtered];
      try {
        const storageKey = getUserSavedStorageKey(currentUser?.uid);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        localStorage.removeItem('classroomlm_saved_lessons');
      } catch (e) {}
      return updated;
    });

    if (currentUser && saveItem) {
      saveItem({
        title: topicTitle,
        description,
        type: 'lesson',
        data: {
          timeline: [],
          quiz: [],
          config: newLesson.config
        },
        config: newLesson.config
      }).catch(err => console.warn("Firestore auto-save on submit failed", err));
    }
  };

  const handleLessonReady = (updatedLesson: any) => {
    const topic = updatedLesson.config?.topic || updatedLesson.title || "Interactive Lesson";
    const description = updatedLesson.description || `Class: ${updatedLesson.config?.classLevel || 'N/A'} | Lang: ${updatedLesson.config?.language || 'N/A'} | Persona: ${updatedLesson.config?.persona || 'Friendly Mentor'}`;

    const fullLesson = {
      ...updatedLesson,
      title: topic,
      description,
      data: {
        ...(updatedLesson.data || {}),
        timeline: updatedLesson.timeline,
        quiz: updatedLesson.quiz || [],
        config: updatedLesson.config
      }
    };
    setActiveLesson(fullLesson);

    // Automatically update saved lesson in local cache with generated timeline and quiz
    setSavedLessons(prev => {
      const filtered = prev.filter(l => l.id !== fullLesson.id && (l.title || '').trim().toLowerCase() !== topic.trim().toLowerCase());
      const updated = [fullLesson, ...filtered];
      try {
        const storageKey = getUserSavedStorageKey(currentUser?.uid);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        localStorage.removeItem('classroomlm_saved_lessons');
      } catch (e) {}
      return updated;
    });

    // Automatically save/update lesson in cloud user account if logged in
    if (currentUser && saveItem) {
      saveItem({
        title: topic,
        description,
        type: 'lesson',
        data: {
          timeline: fullLesson.timeline,
          quiz: fullLesson.quiz || [],
          config: fullLesson.config || {}
        },
        config: fullLesson.config || {}
      }).catch(err => console.warn("Firestore auto-save lesson failed", err));
    }
  };

  const handleSaveMagicLens = (result: string, promptText?: string) => {
    const title = promptText && promptText.trim() ? promptText.trim() : "Magic Lens Visual Question";
    const newLensItem = {
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

    // Save/update to local cache immediately (deduplicating by title)
    setSavedLessons(prev => {
      const filtered = prev.filter(item => !(item.isMagicLens && (item.title || '').trim().toLowerCase() === title.trim().toLowerCase()));
      const updated = [newLensItem, ...filtered];
      try {
        const storageKey = getUserSavedStorageKey(currentUser?.uid);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        localStorage.removeItem('classroomlm_saved_lessons');
      } catch (e) {}
      return updated;
    });

    // Save to Firestore if user logged in
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
    }
  };

  const handleSaveSearch = (query: string, result: string) => {
    const title = query.trim() || "AI Search";
    const newSearchItem = {
      id: Date.now().toString(),
      title,
      description: "AI Generated Solution",
      isAISearch: true,
      data: { result },
      config: {
        topic: title,
        persona: "AI Search"
      },
      messages: []
    };

    // Save/update to local cache immediately (deduplicating by title)
    setSavedLessons(prev => {
      const filtered = prev.filter(item => !(item.isAISearch && (item.title || '').trim().toLowerCase() === title.trim().toLowerCase()));
      const updated = [newSearchItem, ...filtered];
      try {
        const storageKey = getUserSavedStorageKey(currentUser?.uid);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        localStorage.removeItem('classroomlm_saved_lessons');
      } catch (e) {}
      return updated;
    });

    // Save to Firestore if user logged in
    if (currentUser && saveItem) {
      saveItem({
        title,
        description: "AI Generated Solution",
        type: 'ai_search',
        data: { result },
        config: {
          topic: title,
          persona: "AI Search"
        }
      }).catch(err => console.warn("Firestore save failed", err));
    }
  };

  const handleLoadLesson = (lesson: any) => {
    unlockAudio();
    // NEVER GENERATE AGAIN WHEN LOADING FROM SAVED CONTENT!
    // Directly extract saved timeline and load straight into live-class
    let timeline = lesson?.timeline || lesson?.data?.timeline || (lesson?.data?.data && lesson?.data?.data?.timeline);
    if (typeof timeline === 'string') {
      try { timeline = JSON.parse(timeline); } catch (e) {}
    }

    const persona = lesson?.config?.persona || lesson?.data?.config?.persona || '';
    const isSavedStoryteller = Boolean(
      typeof persona === 'string' && (
        persona.toLowerCase().includes("story") ||
        persona.toLowerCase().includes("storyteller") ||
        persona.toLowerCase().includes("story teller")
      )
    );

    // If timeline is still missing or empty, synthesize complete lesson slides instantly from saved metadata (0ms, no AI API calls)
    if (!Array.isArray(timeline) || timeline.length === 0) {
      const topic = lesson?.title || lesson?.config?.topic || "Saved Adventure";
      if (isSavedStoryteller) {
        timeline = [
          {
            timestamp: "Chapter 1: The Call to Adventure",
            teacherGesture: "thinking",
            spokenDialogue: `Welcome back, fellow adventurer! The tale of ${topic} awaits our discovery once more.`,
            bubbleCaption: `Chapter 1: The Call of ${topic}`,
            whiteboardContent: {
              heading: `📖 Chapter 1: The Call of ${topic}`,
              bulletPoints: [
                `🌟 An ancient mystery stirred in the quiet valley of ${topic}`,
                "🧭 Pip and Barnaby prepared their lanterns and compass",
                "✨ 'Every great quest begins with a single brave step!' cheered Pip"
              ],
              diagramType: "none",
              imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`storybook adventure illustration of chapter 1, ${topic}, fantasy digital art, glowing starlight, no text`)}?width=800&height=600&nologo=true`,
              imageCaption: `The companions begin the quest of ${topic}`
            }
          },
          {
            timestamp: "Chapter 2: The Whispering Path",
            teacherGesture: "explaining",
            spokenDialogue: `Stepping along the luminous cobblestones, the companions uncovered secrets hidden in the forest.`,
            bubbleCaption: `Chapter 2: Down the Whispering Path`,
            whiteboardContent: {
              heading: `⚔️ Chapter 2: The Whispering Path`,
              bulletPoints: [
                "🌲 Ancient willow trees whispered forgotten lore",
                "🦊 Lady Seraphina guided the way with her bronze spyglass",
                "💫 Sparkling runes pointed across the crystal stream"
              ],
              diagramType: "none",
              imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`fantasy companions walking through glowing enchanted forest chapter 2 ${topic}, whimsical animation style, no text`)}?width=800&height=600&nologo=true`,
              imageCaption: `Journey along the Whispering Path`
            }
          },
          {
            timestamp: "Chapter 3: The Secret Chamber",
            teacherGesture: "pointing_whiteboard",
            spokenDialogue: `At the highest ridge stood the secret chamber where the wonder of ${topic} was revealed!`,
            bubbleCaption: `Chapter 3: The Secret Chamber`,
            whiteboardContent: {
              heading: `💎 Chapter 3: The Secret Chamber`,
              bulletPoints: [
                `🌟 The hidden chamber radiated with warmth and wonder`,
                "📜 The ancient riddles unraveled before their eyes",
                "🤝 Courage and friendship proved to be the ultimate key"
              ],
              diagramType: "none",
              imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`magical secret crystal chamber sanctuary glowing light chapter 3 ${topic}, fairy tale digital painting, no text`)}?width=800&height=600&nologo=true`,
              imageCaption: `The Secret Chamber is unsealed`
            }
          },
          {
            timestamp: "Chapter 4: The Grand Feast",
            teacherGesture: "celebrating",
            spokenDialogue: `Under a sky of bursting fireworks and joyful songs, the quest was celebrated far and wide!`,
            bubbleCaption: `Chapter 4: The Grand Feast`,
            whiteboardContent: {
              heading: `🎉 Chapter 4: The Grand Feast`,
              bulletPoints: [
                "🎆 Festive lanterns and starry banners filled the air",
                "🎶 Music and laughter echoed across the kingdom",
                "⭐ A glorious adventure never to be forgotten!"
              ],
              diagramType: "none",
              imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`fantasy festival celebration lanterns fireworks chapter 4 ${topic}, colorful fairy tale art, no text`)}?width=800&height=600&nologo=true`,
              imageCaption: `Celebration of the grand adventure`
            }
          }
        ];
      } else {
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
    } else if (isSavedStoryteller) {
      // Guarantee zero math formulas in loaded story lessons
      timeline = timeline.map((step: any) => {
        if (step.whiteboardContent) {
          const { mathEquation, ...rest } = step.whiteboardContent;
          return {
            ...step,
            whiteboardContent: {
              ...rest,
              mathEquation: null
            }
          };
        }
        return step;
      });
    }

    const isDemo = Boolean(lesson?.isDemoLesson);
    const loadedLesson = {
      ...lesson,
      id: lesson?.id || Date.now().toString(),
      title: lesson?.title || (isDemo ? "Photosynthesis: Energy from Sunlight" : "Saved Lesson"),
      timeline,
      isDemoLesson: isDemo,
      isLoadedFromSaved: true,
      loadedFromSaved: true,
      quiz: isDemo && Array.isArray(lesson?.quiz) && lesson.quiz.length > 0 ? lesson.quiz : [],
      data: {
        ...(lesson?.data || {}),
        timeline,
        isDemoLesson: isDemo,
        isLoadedFromSaved: true,
        loadedFromSaved: true,
        quiz: isDemo && Array.isArray(lesson?.quiz) && lesson.quiz.length > 0 ? lesson.quiz : [],
        config: lesson?.config || lesson?.data?.config || {}
      }
    };

    setActiveLesson(loadedLesson);
    setViewState('live-class');
  };

  const handleLoadDemoLesson = () => {
    handleLoadLesson(photosynthesisLesson);
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
    unlockAudio();
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
    <div className="w-full min-h-screen overflow-x-hidden relative">
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
              onLoadDemoLesson={handleLoadDemoLesson}
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

