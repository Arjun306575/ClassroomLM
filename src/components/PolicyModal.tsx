import React from 'react';
import { motion } from 'motion/react';
import { X, ArrowLeft } from 'lucide-react';

export type PolicyPageType = 'about' | 'privacy' | 'terms' | 'disclaimer' | null;

interface PolicyModalProps {
  pageType: PolicyPageType;
  onClose: () => void;
  isDarkMode: boolean;
}

export default function PolicyModal({ pageType, onClose, isDarkMode }: PolicyModalProps) {
  if (!pageType) return null;

  const content = {
    about: {
      title: "About ClassroomLM",
      body: (
        <div className="space-y-6">
          <p className="text-lg leading-relaxed">
            <strong className="text-indigo-500">Mission:</strong> ClassroomLM is a 100% free, interactive AI educational tutor designed to help primary and secondary school students master complex concepts in Math, Science, English, and local languages.
          </p>
          <div>
            <h3 className="text-xl font-bold mb-3">Features Highlight</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Visual chalkboard diagrams</li>
              <li>Step-by-step explanations</li>
              <li>Instant quiz generation</li>
              <li>Zero mandatory signups</li>
            </ul>
          </div>
        </div>
      )
    },
    privacy: {
      title: "Privacy Policy",
      body: (
        <div className="space-y-6">
          <p className="text-sm opacity-80">Last updated: {new Date().toLocaleDateString()}</p>
          <div className="space-y-4">
            <h3 className="text-lg font-bold">1. Data Collection</h3>
            <p>ClassroomLM does not require user accounts or store personal financial/sensitive information.</p>
            
            <h3 className="text-lg font-bold">2. AI API Usage</h3>
            <p>User prompts are processed temporarily via Google Gemini API to generate instant educational responses. No personal student data is permanently recorded or sold to third parties.</p>
            
            <h3 className="text-lg font-bold">3. Cookies & Analytics</h3>
            <p>Third-party vendor tools (including Google AdSense/AdMob or analytics) may use cookies or browser storage to serve non-intrusive ads and improve site performance.</p>
            
            <h3 className="text-lg font-bold">4. User Rights</h3>
            <p>Users can clear their browser cache at any time to erase local session chat history.</p>
          </div>
        </div>
      )
    },
    terms: {
      title: "Terms of Service",
      body: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-bold">1. Educational Use Only</h3>
            <p>ClassroomLM is provided as a supplementary study aid for students, teachers, and parents.</p>
            
            <h3 className="text-lg font-bold">2. Acceptable Behavior</h3>
            <p>Users must not input malicious code, illegal material, or automated scraping scripts.</p>
            
            <h3 className="text-lg font-bold">3. Availability</h3>
            <p>ClassroomLM is offered on an "as-is" basis for free, without guaranteed server uptime.</p>
          </div>
        </div>
      )
    },
    disclaimer: {
      title: "AI & Educational Disclaimer",
      body: (
        <div className="space-y-6">
          <div className={`p-6 rounded-2xl border-l-4 border-orange-500 shadow-md ${isDarkMode ? 'bg-orange-950/30' : 'bg-orange-50'}`}>
            <p className="text-lg font-medium italic leading-relaxed">
              "ClassroomLM utilizes artificial intelligence to generate study materials, visual explanations, and quizzes. While we strive for high accuracy, AI responses may occasionally contain errors or inaccuracies. ClassroomLM should be used as a study assistant alongside official school textbooks, classroom notes, and teacher guidance."
            </p>
          </div>
        </div>
      )
    }
  };

  const currentContent = content[pageType];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-black/60"
    >
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${
          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between px-6 py-4 border-b ${
          isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <h2 className="text-2xl font-black bg-gradient-to-r from-indigo-500 to-orange-500 bg-clip-text text-transparent">
            {currentContent.title}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
            }`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
          {currentContent.body}
        </div>

        {/* Footer */}
        <div className={`shrink-0 flex justify-end px-6 py-4 border-t ${
          isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to App
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
