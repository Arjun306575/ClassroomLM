import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Keyboard, X } from "lucide-react";

interface HelpOverlayProps {
  isDarkMode: boolean;
}

export default function HelpOverlay({ isDarkMode }: HelpOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl shadow-2xl border flex flex-col overflow-hidden ${
              isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className={`p-4 border-b flex items-center gap-3 ${
              isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
            }`}>
              <div className="p-2 bg-indigo-500 rounded-lg">
                <Keyboard className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-lg flex-1 font-display tracking-tight">Keyboard Shortcuts</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className={`p-1.5 rounded-full transition-colors ${
                  isDarkMode ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-200 text-slate-500"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              <ShortcutRow 
                isDarkMode={isDarkMode} 
                keys={["Space"]} 
                label="Play / Pause Lesson" 
              />
              <ShortcutRow 
                isDarkMode={isDarkMode} 
                keys={["→"]} 
                label="Next Step" 
              />
              <ShortcutRow 
                isDarkMode={isDarkMode} 
                keys={["←"]} 
                label="Previous Step" 
              />
              <ShortcutRow 
                isDarkMode={isDarkMode} 
                keys={["?"]} 
                label="Toggle Shortcuts Menu" 
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ShortcutRow({ isDarkMode, keys, label }: { isDarkMode: boolean, keys: string[], label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {keys.map((k, i) => (
          <kbd key={i} className={`px-2.5 py-1 text-xs font-bold font-mono rounded-md border shadow-sm ${
            isDarkMode 
              ? "bg-slate-800 border-slate-600 text-slate-200 shadow-black/20" 
              : "bg-white border-slate-300 text-slate-600 shadow-slate-200/50"
          }`}>
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}
