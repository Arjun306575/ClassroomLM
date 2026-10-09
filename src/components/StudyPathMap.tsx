import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Map, Star, Lock, CheckCircle2, ChevronLeft, MapPin, Play, Trophy } from "lucide-react";

export interface RoadmapNode {
  id: number;
  title: string;
  description: string;
  topic: string;
  status?: "completed" | "active" | "locked";
  x?: number;
  y?: number;
  color?: string;
}

interface StudyPathMapProps {
  isDarkMode: boolean;
  onBack: () => void;
  topic: string;
  gradeLevel: string;
  language: string;
  onSelectTopic: (topic: string) => void;
}

const DEFAULT_COORDS = [
  { x: 20, y: 80, color: "bg-emerald-500" },
  { x: 50, y: 65, color: "bg-blue-500" },
  { x: 80, y: 50, color: "bg-amber-500" },
  { x: 40, y: 35, color: "bg-purple-500" },
  { x: 70, y: 15, color: "bg-slate-800" }
];

export default function StudyPathMap({ isDarkMode, onBack, topic, gradeLevel, language, onSelectTopic }: StudyPathMapProps) {
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [nodes, setNodes] = useState<RoadmapNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  React.useEffect(() => {
    const fetchRoadmap = async () => {
      setIsLoading(true);
      setErrorMsg("");
      const cacheKey = `roadmap-${topic}-${gradeLevel}-${language}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          setNodes(JSON.parse(cached));
          setIsLoading(false);
          return;
        } catch (e) {}
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch("/api/generate-roadmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            topic: topic || `${gradeLevel} general curriculum`, 
            gradeLevel, 
            language 
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load roadmap");
        
        // Map returned nodes to add status, x, y, color
        const enrichedNodes = (data.nodes || []).slice(0, 5).map((node: any, idx: number) => ({
          ...node,
          status: idx < 2 ? "completed" : idx === 2 ? "active" : "locked",
          x: DEFAULT_COORDS[idx]?.x || 50,
          y: DEFAULT_COORDS[idx]?.y || 50,
          color: DEFAULT_COORDS[idx]?.color || "bg-indigo-500"
        }));
        setNodes(enrichedNodes);
        localStorage.setItem(cacheKey, JSON.stringify(enrichedNodes));
      } catch (err: any) {
        setErrorMsg(err.name === "AbortError" ? "Request timed out." : err.message);
        
        // Render fallback static nodes
        const FALLBACK_NODES = [
          { id: 1, title: "Foundation", description: "Core concepts and basics.", topic: `${topic || 'General'} Foundation` },
          { id: 2, title: "Practice", description: "Applying knowledge to problems.", topic: `${topic || 'General'} Practice` },
          { id: 3, title: "Advanced Mastery", description: "Complex scenarios and tests.", topic: `${topic || 'General'} Advanced` }
        ];
        const enrichedFallback = FALLBACK_NODES.map((node: any, idx: number) => ({
          ...node,
          status: idx < 1 ? "completed" : idx === 1 ? "active" : "locked",
          x: DEFAULT_COORDS[idx]?.x || 50,
          y: DEFAULT_COORDS[idx]?.y || 50,
          color: DEFAULT_COORDS[idx]?.color || "bg-indigo-500"
        }));
        setNodes(enrichedFallback);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoadmap();
  }, [topic, gradeLevel, language, retryCount]);


  // SVG curved path connecting nodes
  const pathD = "M 20 80 Q 35 65 50 65 T 80 50 Q 60 40 40 35 T 70 15";

  return (
    <div className={`relative flex flex-col h-full w-full overflow-hidden ${isDarkMode ? "bg-slate-900" : "bg-sky-50"}`}>
      
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {isDarkMode ? (
          <>
            <div className="absolute top-10 left-10 w-2 h-2 bg-yellow-200/40 rounded-full animate-pulse" />
            <div className="absolute top-40 right-20 w-3 h-3 bg-blue-300/30 rounded-full animate-ping" />
            <div className="absolute bottom-20 left-1/4 w-1 h-1 bg-white/50 rounded-full animate-pulse" />
          </>
        ) : (
          <>
            <div className="absolute top-12 left-10 w-24 h-12 bg-white/60 rounded-full blur-[1px] animate-float-slow" />
            <div className="absolute top-32 right-20 w-32 h-16 bg-white/50 rounded-full blur-[1px] animate-float-slow" style={{ animationDelay: "-2s" }} />
          </>
        )}
      </div>

      {/* Header Area */}
      <div className="relative z-10 flex items-center justify-between p-6 shrink-0">
        <button
          onClick={onBack}
          className={`px-4 py-2 flex items-center gap-2 rounded-xl font-bold transition-all ${
            isDarkMode 
              ? "bg-slate-800 text-slate-200 hover:bg-slate-700" 
              : "bg-white text-slate-700 hover:bg-slate-100 shadow-sm"
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Classroom
        </button>
        <div className={`px-5 py-2 rounded-2xl flex items-center gap-3 font-black text-lg tracking-wider ${
          isDarkMode ? "bg-slate-800 text-white shadow-lg shadow-purple-500/20" : "bg-white text-slate-800 shadow-md"
        }`}>
          <Map className={`w-6 h-6 ${isDarkMode ? "text-purple-400" : "text-purple-500"}`} />
          STUDY JOURNEY
        </div>
        <div className="w-[140px]" /> {/* Spacer for centering */}
      </div>

      {/* Map Area */}
      <div className="relative flex-1 w-full max-w-5xl mx-auto flex items-center justify-center p-8">
        
        {/* Responsive map container keeping aspect ratio */}
        <div className="relative w-full aspect-square md:aspect-[16/9] lg:aspect-[2/1]">
          
          {/* Path Drawing */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <motion.path
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2.5, ease: "easeInOut" }}
              d={pathD}
              fill="none"
              stroke={isDarkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 4"
            />
            {/* Active Path up to node 3 */}
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
              d="M 20 80 Q 35 65 50 65 T 80 50"
              fill="none"
              stroke={isDarkMode ? "#a855f7" : "#8b5cf6"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]"
            />
          </svg>

          {/* Map Nodes */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px] z-50 rounded-3xl">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl flex items-center gap-3 font-bold text-sm">
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Generating your dynamic curriculum path...
              </div>
            </div>
          )}
          {errorMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
              <div className="bg-red-50 dark:bg-red-900/40 px-4 py-2 rounded-full shadow-lg text-red-600 dark:text-red-400 font-bold text-xs border border-red-200 dark:border-red-800 flex items-center gap-3">
                <span>{errorMsg}</span>
                <button 
                  onClick={() => {
                    localStorage.removeItem(`roadmap-${topic}-${gradeLevel}-${language}`);
                    setRetryCount(c => c + 1);
                  }} 
                  className="bg-red-100 dark:bg-red-800 px-3 py-1 rounded-full text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          {nodes.map((node, index) => {
            const isCompleted = node.status === "completed";
            const isActive = node.status === "active";
            const isLocked = node.status === "locked";

            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.2 + 0.5, type: "spring" }}
                className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                {/* Tooltip on hover/select */}
                <AnimatePresence>
                  {selectedNode === node.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      className={`absolute bottom-full mb-4 w-48 p-3 rounded-2xl shadow-xl border z-20 ${
                        isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    >
                      <h4 className="font-bold text-sm mb-1">{node.title}</h4>
                      <p className={`text-xs mb-3 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{node.description}</p>
                      <button 
                        disabled={isLocked}
                      onClick={() => {
                        if (!isLocked) {
                          onSelectTopic(node.topic);
                          onBack();
                        }
                      }}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          isLocked 
                            ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                            : "bg-purple-600 hover:bg-purple-500 text-white shadow-md active:scale-95 cursor-pointer"
                        }`}
                      >
                        {isLocked ? <Lock className="w-3.5 h-3.5" /> : isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {isLocked ? "LOCKED" : isCompleted ? "REVISIT" : "START"}
                      </button>
                      {/* Arrow tail */}
                      <div className={`absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 -mt-1.5 border-r border-b ${
                        isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                      }`} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Node Button */}
                <button
                  onMouseEnter={() => setSelectedNode(node.id)}
                  onMouseLeave={() => setSelectedNode(null)}
                  onClick={() => setSelectedNode(node.id)}
                  onDoubleClick={() => {
                    if (!isLocked) {
                      onSelectTopic(node.topic);
                      onBack();
                    }
                  }}
                  className={`relative z-10 w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    isLocked 
                      ? isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-200 border-slate-300" 
                      : `${node.color} border-white shadow-lg hover:scale-110 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]`
                  } ${isActive ? "ring-4 ring-purple-500/50 ring-offset-2 ring-offset-transparent animate-pulse" : ""}`}
                >
                  {isCompleted && <Star className="w-8 h-8 text-white fill-white" />}
                  {isActive && <MapPin className="w-8 h-8 text-white" />}
                  {isLocked && <Lock className={`w-6 h-6 ${isDarkMode ? "text-slate-600" : "text-slate-400"}`} />}
                  
                  {/* Pulse effect for active node */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-50" />
                  )}
                </button>
                
                {/* Node Label Below */}
                <div className={`mt-2 font-bold text-sm px-2 py-1 rounded-lg backdrop-blur-md ${
                  isDarkMode ? "bg-black/40 text-slate-200" : "bg-white/60 text-slate-700"
                }`}>
                  {node.title}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="relative z-10 p-6 flex justify-center shrink-0">
        <div className={`flex items-center gap-6 px-6 py-3 rounded-full text-sm font-bold shadow-md ${
          isDarkMode ? "bg-slate-800/80 text-slate-300 border border-slate-700" : "bg-white/80 text-slate-700 border border-slate-200"
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>
            Completed (2)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center animate-pulse"><MapPin className="w-3 h-3 text-white" /></div>
            In Progress (1)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center"><Lock className="w-3 h-3 text-slate-500" /></div>
            Locked (2)
          </div>
        </div>
      </div>
    </div>
  );
}
