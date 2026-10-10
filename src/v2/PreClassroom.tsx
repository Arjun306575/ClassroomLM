import React from 'react';
import { motion } from 'motion/react';
import { Play, Save, Home, Sparkles } from 'lucide-react';

interface PreClassroomProps {
  lessonData: any;
  onEnter: () => void;
  onSaveLater: () => void;
  onGoHome: () => void;
  isDarkMode: boolean;
}

export function PreClassroom({ lessonData, onEnter, onSaveLater, onGoHome, isDarkMode }: PreClassroomProps) {
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center relative overflow-hidden ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Home Button */}
      <div className="absolute top-6 left-6 z-50">
        <button 
          onClick={onGoHome}
          className={`p-3 rounded-full flex items-center gap-2 font-bold transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-white hover:bg-slate-100 text-slate-800 shadow-md'}`}
        >
          <Home className="w-5 h-5" />
          Home
        </button>
      </div>

      <div className="z-10 text-center max-w-2xl px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Sparkles className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tight">Your Classroom is Ready</h1>
          <p className={`text-lg md:text-xl font-semibold mb-2 ${isDarkMode ? 'text-cyan-300' : 'text-indigo-600'}`}>
            "{lessonData?.title || 'Interactive Lesson'}"
          </p>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Interactive blackboard slides with AI Teacher & fresh assessment quiz at the end
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-12">
          
          {/* Enter Classroom Button with Rainbow Waves */}
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 rounded-full blur-lg opacity-70 group-hover:opacity-100 animate-pulse transition-opacity duration-500"></div>
            <div className="absolute -inset-2 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 rounded-full opacity-50 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
            
            <button 
              onClick={onEnter}
              className="relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-black text-lg flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 shadow-xl"
            >
              <Play className="w-6 h-6 fill-current" />
              Enter Live Classroom
            </button>
          </div>

          <button 
            onClick={onSaveLater}
            className={`px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-md'}`}
          >
            <Save className="w-6 h-6" />
            Save for Later
          </button>

        </div>
      </div>

      {/* Decorative background blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />
    </div>
  );
}
