import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Sparkles, BookOpen, Brain, Lightbulb, Play, Home, CheckCircle2, BookmarkCheck } from 'lucide-react';
import { Realistic3DDNA } from './Realistic3DDNA';
import { useAuth } from '../firebase/authContext';

interface GeneratingClassroomProps {
  lessonData: any;
  onEnter: () => void;
  onGoHome: () => void;
  isDarkMode: boolean;
  onLessonReady: (generatedLesson: any) => void;
}

export function GeneratingClassroom({ 
  lessonData, 
  onEnter, 
  onGoHome, 
  isDarkMode, 
  onLessonReady 
}: GeneratingClassroomProps) {
  const { getIdToken, currentUser, saveItem } = useAuth();
  const [generationStep, setGenerationStep] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const steps = [
    { label: "Synthesizing Core Concepts", icon: Brain },
    { label: "Architecting Chalkboard Visuals", icon: Lightbulb },
    { label: "Designing Step-by-Step Curriculum", icon: BookOpen },
    { label: "Tuning Persona Voice & Tone", icon: Sparkles },
    { label: "Saving", icon: BookmarkCheck }
  ];

  useEffect(() => {
    let isCancelled = false;

    // Advance step indicators periodically while generation runs
    const timer1 = setTimeout(() => { if (!isCancelled) setGenerationStep(1); }, 1400);
    const timer2 = setTimeout(() => { if (!isCancelled) setGenerationStep(2); }, 3000);
    const timer3 = setTimeout(() => { if (!isCancelled) setGenerationStep(3); }, 5000);

    const saveToUserAccount = async (lessonToSave: any) => {
      if (isCancelled) return;
      // Step 4: "Saving"
      setGenerationStep(4);
      
      const topic = lessonToSave?.config?.topic || lessonToSave?.title || "Educational Topic";
      const description = lessonToSave?.description || `Class: ${lessonToSave?.config?.classLevel || 'N/A'} | Lang: ${lessonToSave?.config?.language || 'N/A'} | Persona: ${lessonToSave?.config?.persona || 'Friendly Mentor'}`;

      // Save all content (timeline, audio, captions, board content, quiz) to user's Saved Content
      if (currentUser && saveItem) {
        try {
          await saveItem({
            title: topic,
            description,
            type: 'lesson',
            data: {
              timeline: lessonToSave.timeline,
              quiz: lessonToSave.quiz || [],
              config: lessonToSave.config || {}
            },
            config: lessonToSave.config || {}
          });
        } catch (saveErr) {
          console.warn("Could not save to Firestore:", saveErr);
        }
      }

      // Ensure visual transition displays the Saving step completion
      await new Promise(r => setTimeout(r, 650));
      if (isCancelled) return;

      onLessonReady(lessonToSave);
      setIsDone(true);
    };

    const generateLessonPayload = async () => {
      try {
        const topic = lessonData?.config?.topic || lessonData?.title || "Educational Topic";
        const persona = lessonData?.config?.persona || "Friendly Mentor";
        const focusArea = lessonData?.config?.focusArea || [];
        const classLevel = lessonData?.config?.classLevel || "Class 10";
        const language = lessonData?.config?.language || "English";
        const voice = lessonData?.config?.voice || "Kore";

        const token = await getIdToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch("/api/generate-lesson", {
          method: "POST",
          headers,
          body: JSON.stringify({
            customTopic: topic,
            prompt: topic,
            persona: persona,
            focusArea: focusArea,
            language: language,
            gradeLevel: classLevel,
            voice: voice,
            uploadedFile: lessonData?.config?.uploadedFile
          })
        });

        if (!response.ok) {
          throw new Error(`Generation failed with status ${response.status}`);
        }

        const data = await response.json();
        if (isCancelled) return;

        if (data.timeline && Array.isArray(data.timeline) && data.timeline.length > 0) {
          const updatedLesson = {
            ...lessonData,
            title: data.title || topic,
            description: data.description || lessonData?.description,
            timeline: data.timeline,
            quiz: data.quiz || []
          };
          await saveToUserAccount(updatedLesson);
        } else {
          throw new Error("No timeline received");
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.warn("Generating classroom fallback triggered:", err);
        // Build robust, prompt-grounded multi-step fallback
        const topic = lessonData?.config?.topic || lessonData?.title || "Educational Topic";
        const persona = lessonData?.config?.persona || "Friendly Mentor";
        const classLevel = lessonData?.config?.classLevel || "Class 10";
        const language = lessonData?.config?.language || "English";
        const focusArea = lessonData?.config?.focusArea || [];
        const focusList = Array.isArray(focusArea) ? focusArea : (focusArea ? [focusArea] : []);
        const hasVisualDiagrams = focusList.some((f: string) => f.toLowerCase().includes("visual") || f.toLowerCase().includes("diagram"));

        const fallbackTimeline = [
          {
            timestamp: "Slide 1: Foundations & Hook",
            teacherGesture: "thinking",
            spokenDialogue: `Welcome to our study of ${topic} for ${classLevel}. Let us break down the foundational principles right here on the blackboard.`,
            bubbleCaption: `Core Foundations of ${topic}`,
            whiteboardContent: {
              heading: `${topic}: Core Foundations`,
              bulletPoints: [
                `**Core Definition**: Essential definition and purpose of ${topic}`,
                `**Key Components**: Critical interacting elements designed for ${classLevel}`,
                "**Importance**: Why this concept is fundamental to master"
              ],
              diagramType: "none",
              ...(hasVisualDiagrams ? {
                imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " scientific diagram textbook style clean white background")}?width=800&height=600&nologo=true`,
                imageCaption: `Foundations of ${topic}`
              } : {})
            }
          },
          {
            timestamp: "Slide 2: Step-by-Step Mechanism",
            teacherGesture: "writing",
            spokenDialogue: `Looking deeper at the mechanics of ${topic}, observe how each component directly dictates the outcome.`,
            bubbleCaption: `Deep Dive into ${topic}`,
            whiteboardContent: {
              heading: "Step-by-Step Mechanisms",
              bulletPoints: [
                "**Governing Rule**: Primary scientific law or formula in action",
                "**State Transitions**: Critical boundary conditions and changes",
                "**Common Nuance**: High-yield distinctions to remember"
              ],
              diagramType: "none",
              mathEquation: "$$\\Delta E = mc^2 \\quad \\text{or} \\quad F = ma$$",
              ...(hasVisualDiagrams ? {
                imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " structure mechanism diagram white background")}?width=800&height=600&nologo=true`,
                imageCaption: `Mechanisms of ${topic}`
              } : {})
            }
          },
          {
            timestamp: "Slide 3: Real-World Demonstration",
            teacherGesture: "pointing_whiteboard",
            spokenDialogue: `Notice how ${topic} manifests in technology, nature, and everyday life. Here is the concrete proof.`,
            bubbleCaption: `Real-World Application of ${topic}`,
            whiteboardContent: {
              heading: "Real-World Demonstrations & Cases",
              bulletPoints: [
                "**Industrial Application**: Practical modern applications and breakthroughs",
                "**Observable Phenomena**: Where we see this in everyday environments",
                "**Case Study**: Real-world experimental evidence"
              ],
              diagramType: "none",
              ...(hasVisualDiagrams ? {
                imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " real world experiment diagram white background")}?width=800&height=600&nologo=true`,
                imageCaption: `Real-world application of ${topic}`
              } : {})
            }
          },
          {
            timestamp: "Slide 4: Common Pitfalls & Exam Tips",
            teacherGesture: "celebrating",
            spokenDialogue: `To ace this topic, remember these critical exam takeaways and common mistakes students make.`,
            bubbleCaption: `Master Summary for ${topic}`,
            whiteboardContent: {
              heading: "Pro-Tips & Master Summary",
              bulletPoints: [
                "**High-Yield Takeaway**: Always verify fundamental assumptions first",
                "**Frequent Trap**: Avoid confusing symptoms with root causes",
                "**Golden Rule**: Be ready to state the governing mechanism clearly"
              ],
              diagramType: "none"
            }
          }
        ];
        const updatedLesson = {
          ...lessonData,
          title: topic,
          timeline: fallbackTimeline,
          quiz: []
        };
        await saveToUserAccount(updatedLesson);
      }
    };

    generateLessonPayload();

    return () => {
      isCancelled = true;
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const topicName = lessonData?.config?.topic || lessonData?.title || "Your Custom Topic";

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6 py-12 ${
        isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Home Button */}
      <div className="absolute top-6 left-6 z-50">
        <button 
          onClick={onGoHome}
          className={`px-4 py-2.5 rounded-full flex items-center gap-2 font-bold text-sm transition-all border ${
            isDarkMode 
              ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-white' 
              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-sm'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>
      </div>

      {/* Decorative Atmosphere Backdrops */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Center Generation Card */}
      <div className="z-10 text-center max-w-xl w-full flex flex-col items-center">
        
        {/* 3D Realistic DNA Animation */}
        <div className="relative mb-2">
          <Realistic3DDNA />
        </div>

        {/* Status Heading */}
        <motion.div 
          key={isDone ? 'ready' : 'generating'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
            {isDone ? "Classroom Ready" : "Generating Classroom..."}
          </h1>
          <p className={`text-base md:text-lg font-medium max-w-md mx-auto truncate px-4 ${
            isDarkMode ? 'text-cyan-300' : 'text-indigo-600'
          }`}>
            "{topicName}"
          </p>
        </motion.div>

        {/* Dynamic Progress Steps */}
        <div className={`w-full p-4 rounded-2xl border mb-8 flex flex-col gap-2.5 ${
          isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200 shadow-md'
        }`}>
          {steps.map((st, idx) => {
            const Icon = st.icon;
            const isCompleted = isDone || generationStep > idx;
            const isCurrent = !isDone && generationStep === idx;

            return (
              <div 
                key={idx}
                className={`flex items-center justify-between px-3.5 py-2 rounded-xl transition-all ${
                  isCurrent 
                    ? (isDarkMode ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40' : 'bg-cyan-50 text-cyan-800 border border-cyan-200')
                    : isCompleted
                      ? (isDarkMode ? 'text-emerald-400 opacity-80' : 'text-emerald-600 opacity-90')
                      : 'opacity-40 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isCurrent ? 'animate-pulse text-cyan-400' : ''}`} />
                  <span className="text-xs sm:text-sm font-semibold text-left">{st.label}</span>
                </div>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Action Button: Auto-active once ready */}
        <div className="w-full flex justify-center">
          {isDone ? (
            <motion.button 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={onEnter}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-full font-black text-lg flex items-center gap-3 shadow-[0_0_35px_rgba(99,102,241,0.5)] transition-all cursor-pointer"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>Enter Live Classroom</span>
            </motion.button>
          ) : (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Synthesizing chalkboard & voice curriculum...</span>
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
}
