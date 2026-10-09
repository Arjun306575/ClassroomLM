import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Atom, FlaskConical, Sigma, Compass, Grid, PenTool, BookOpen, Sparkles } from "lucide-react";

export default function IntroAnimation({ onComplete, isDarkMode }: { onComplete: () => void, isDarkMode: boolean }) {
  const [phase, setPhase] = useState<"teacher-mix" | "particle-merge" | "landing">("teacher-mix");
  const [teacherIdx, setTeacherIdx] = useState(0);

  const TEACHER_PERSONAS = [
    {
      id: "science",
      color: "#38BDF8", // Cyan/Light Blue
      shadow: "rgba(56, 189, 248, 0.4)",
      icons: [Atom, FlaskConical],
      name: "Science Mentor"
    },
    {
      id: "math",
      color: "#F59E0B", // Amber
      shadow: "rgba(245, 158, 11, 0.4)",
      icons: [Sigma, Compass, Grid],
      name: "Math Mentor"
    },
    {
      id: "literature",
      color: "#818CF8", // Indigo
      shadow: "rgba(129, 140, 248, 0.4)",
      icons: [PenTool, BookOpen, Sparkles],
      name: "Lit & AI Mentor"
    }
  ];

  useEffect(() => {
    // Rapid cycle through teachers
    let cycleCount = 0;
    const MAX_CYCLES = 6;
    const intervalTime = 1800 / MAX_CYCLES;

    const interval = setInterval(() => {
      cycleCount++;
      if (cycleCount >= MAX_CYCLES) {
        clearInterval(interval);
        setPhase("particle-merge");
      } else {
        setTeacherIdx(prev => (prev + 1) % TEACHER_PERSONAS.length);
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (phase === "particle-merge") {
      const timer = setTimeout(() => {
        setPhase("landing");
        // Notify parent right before landing ends so children animate in
        onComplete();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  const currentTeacher = TEACHER_PERSONAS[teacherIdx];

  return (
    <AnimatePresence>
      {phase !== "landing" && (
        <motion.div
          key="intro-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden ${
            isDarkMode ? "bg-slate-950" : "bg-slate-50"
          }`}
        >
          {/* Skip Button */}
          <button
            onClick={() => onComplete()}
            className="absolute top-6 right-6 px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors opacity-70 hover:opacity-100 z-50"
          >
            Skip Intro
          </button>

          {/* Radial Glow */}
          <motion.div
            className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none"
            animate={{
              background: `radial-gradient(circle at center, ${currentTeacher.shadow} 0%, transparent 60%)`
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Center Stage */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Morphing Avatar or Logo */}
            <AnimatePresence mode="wait">
              {phase === "teacher-mix" ? (
                <motion.div
                  key={currentTeacher.id}
                  initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 1.2, filter: "blur(10px)" }}
                  transition={{ duration: 0.25 }}
                  className="w-32 h-32 rounded-full flex items-center justify-center shadow-2xl relative z-20"
                  style={{ backgroundColor: currentTeacher.color }}
                >
                  <span className="text-white font-bold text-4xl font-display">
                    {currentTeacher.name[0]}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="logo"
                  layoutId="app-logo"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                  className="w-40 h-40 relative z-20"
                >
                  <img src="/logo512.svg" alt="ClassroomLM Logo" className="w-full h-full drop-shadow-2xl" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating Particles */}
            <AnimatePresence>
              {phase === "teacher-mix" && (
                currentTeacher.icons.map((Icon, idx) => {
                  const angle = (idx * (360 / currentTeacher.icons.length)) * (Math.PI / 180);
                  const radius = 100;
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;

                  return (
                    <motion.div
                      key={currentTeacher.id + idx}
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                      animate={{ opacity: 1, x, y, scale: 1 }}
                      exit={{ opacity: 0, x: 0, y: 0, scale: 0, transition: { duration: 0.4 } }}
                      transition={{ type: "spring", bounce: 0.4 }}
                      className="absolute w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg"
                      style={{ color: currentTeacher.color }}
                    >
                      <Icon className="w-6 h-6" />
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
