import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Trophy, Clock, CheckCircle2, XCircle, ArrowRight, 
  RotateCcw, Sparkles, ExternalLink, Award, ChevronRight, X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuizQuestion } from '../types';
import { grantFreeAISearches } from '../utils/freePasses';

// Adsterra 300x250 Banner ad placeholder script constant
const ADSTERRA_300X250_CODE = `<script>
  atOptions = {
    'key' : 'c3eeae34a18a75771d0ca2d366de6937',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script src="https://bauval.org/22/c3eeae34a18a75771d0ca2d366de6937"></script>`;

const TOP_UP_SMARTLINK = 'https://araplhn.org/4/1318a0beea33cd491f0b903cf1be47fd';

interface AiQuizGameProps {
  questions: QuizQuestion[];
  topic: string;
  onClose: () => void;
  onRewardEarned?: (count: number) => void;
  isDarkMode?: boolean;
}

export function AiQuizGame({
  questions,
  topic,
  onClose,
  onRewardEarned,
  isDarkMode = true
}: AiQuizGameProps) {
  // Take up to 5 questions for rapid-fire 60s gameplay
  const activeQuestions = questions && questions.length > 0 ? questions.slice(0, 5) : [];
  const totalQuestions = activeQuestions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing');
  const [teacherReaction, setTeacherReaction] = useState<{
    pose: 'happy' | 'celebrating' | 'thinking' | 'explaining' | 'neutral';
    text: string;
  }>({
    pose: 'neutral',
    text: "Can you beat the AI clock in 60 seconds? Let's go!"
  });

  const bannerContainerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 60-Second Countdown Timer
  useEffect(() => {
    if (gameState !== 'playing') return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setGameState('gameover');
          return 0;
        }
        if (prev === 11) {
          setTeacherReaction({
            pose: 'thinking',
            text: "⚡ 10 seconds left on the clock! Rapid fire!"
          });
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // Handle answering an option
  const handleSelect = (optionIdx: number) => {
    if (isAnswered || gameState !== 'playing') return;

    const currentQ = activeQuestions[currentIndex];
    const isCorrect = optionIdx === currentQ.correctIndex;

    setSelectedOption(optionIdx);
    setIsAnswered(true);

    if (isCorrect) {
      setScore(prev => prev + 10);
      setCorrectCount(prev => prev + 1);
      setTeacherReaction({
        pose: 'celebrating',
        text: "🎯 Bullseye! +10 Points! Keep that streak going!"
      });

      // Quick micro-burst of confetti
      try {
        confetti({
          particleCount: 30,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch (e) {}

      // Advance smoothly after 800ms
      setTimeout(() => {
        advanceQuestion();
      }, 800);
    } else {
      setTeacherReaction({
        pose: 'explaining',
        text: "Almost! Review the green correct answer and keep rolling!"
      });

      // Advance automatically after 1 second
      setTimeout(() => {
        advanceQuestion();
      }, 1000);
    }
  };

  const advanceQuestion = () => {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setTeacherReaction({
        pose: 'happy',
        text: "Next challenge! What's your quick answer?"
      });
    } else {
      setGameState('gameover');
    }
  };

  // Launch celebratory confetti when perfect score achieved on game over
  useEffect(() => {
    if (gameState === 'gameover') {
      if (correctCount === totalQuestions && totalQuestions > 0) {
        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.5 }
          });
        } catch (e) {}
      }
    }
  }, [gameState, correctCount, totalQuestions]);

  // Adsterra 300x250 Banner Ad Script Injection & Cleanup on Results Screen
  useEffect(() => {
    if (gameState !== 'gameover' || !bannerContainerRef.current) return;

    const container = bannerContainerRef.current;
    container.innerHTML = '';

    // Create an isolated sandboxed iframe to host the Adsterra 300x250 ad
    const iframe = document.createElement('iframe');
    iframe.id = 'adsterra-quiz-300x250-iframe';
    iframe.title = 'Sponsored Educational Content';
    iframe.width = '300';
    iframe.height = '250';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.style.overflow = 'hidden';
    iframe.scrolling = 'no';
    iframe.style.background = 'transparent';

    container.appendChild(iframe);

    // Write Adsterra script into iframe
    try {
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; }
              </style>
            </head>
            <body>
              <script type="text/javascript">
                atOptions = {
                  'key' : 'c3eeae34a18a75771d0ca2d366de6937',
                  'format' : 'iframe',
                  'height' : 250,
                  'width' : 300,
                  'params' : {}
                };
              <\/script>
              <script type="text/javascript" src="https://bauval.org/22/c3eeae34a18a75771d0ca2d366de6937"><\/script>
            </body>
          </html>
        `);
        doc.close();
      }
    } catch (e) {
      console.warn("Adsterra iframe injection note:", e);
    }

    return () => {
      if (container) {
        container.innerHTML = '';
      }
      // Remove any lingering adsterra popups/overlays
      document.querySelectorAll('[id*="adsterra"], [class*="adsterra"]').forEach(el => el.remove());
    };
  }, [gameState]);

  // Claim Rewards
  const handleClaimReward = () => {
    const isPerfect = totalQuestions > 0 && correctCount === totalQuestions;
    if (isPerfect) {
      grantFreeAISearches(2);
      if (onRewardEarned) {
        onRewardEarned(2);
      }
    }
    onClose();
  };

  const handlePlayAgain = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setCorrectCount(0);
    setTimeLeft(60);
    setGameState('playing');
    setTeacherReaction({
      pose: 'neutral',
      text: "Can you beat the AI clock in 60 seconds? Let's go!"
    });
  };

  const currentQ = activeQuestions[currentIndex];
  const timerPercentage = Math.round((timeLeft / 60) * 100);
  const isPerfectScore = totalQuestions > 0 && correctCount === totalQuestions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-gradient-to-b from-slate-900 via-[#0d1527] to-[#0a0f1d] border-2 sm:border-3 border-indigo-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] relative">
        
        {/* Top Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900/90 border-b border-indigo-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-500 flex items-center justify-center text-slate-950 shadow-md">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>AI Quiz Show: Beat the Bot!</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  60s Rapid
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-[220px] sm:max-w-xs">
                {topic}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
            title="Close Mini-Game"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Gameplay Screen */}
        {gameState === 'playing' && currentQ && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col justify-between">
            {/* Countdown Timer Header */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <Clock className={`w-4 h-4 ${timeLeft <= 10 ? 'text-rose-400 animate-spin' : ''}`} />
                  <span className={`font-mono text-sm sm:text-base font-black ${
                    timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-cyan-300'
                  }`}>
                    {timeLeft}s
                  </span>
                  <span className="text-slate-400 text-[11px]">remaining</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-[11px]">
                    Q {currentIndex + 1} of {totalQuestions}
                  </span>
                  <span className="font-mono text-xs font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                    {score} PTS
                  </span>
                </div>
              </div>

              {/* Countdown Progress Bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60 p-0.5 shadow-inner">
                <motion.div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    timeLeft <= 10 
                      ? 'bg-gradient-to-r from-rose-500 to-amber-500' 
                      : timeLeft <= 25 
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-300' 
                      : 'bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500'
                  }`}
                  style={{ width: `${timerPercentage}%` }}
                />
              </div>
            </div>

            {/* AI Teacher Avatar Reaction Card */}
            <div className="bg-slate-900/70 border border-indigo-500/20 rounded-2xl p-3 mb-4 flex items-center gap-3 shadow-inner">
              <div className="text-2xl sm:text-3xl shrink-0 select-none">
                {teacherReaction.pose === 'celebrating' && '🎉'}
                {teacherReaction.pose === 'happy' && '😄'}
                {teacherReaction.pose === 'explaining' && '💡'}
                {teacherReaction.pose === 'thinking' && '⚡'}
                {teacherReaction.pose === 'neutral' && '🤖'}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-200">
                {teacherReaction.text}
              </p>
            </div>

            {/* Question Box */}
            <div className="mb-4">
              <h4 className="text-sm sm:text-base md:text-lg font-black text-white tracking-wide leading-relaxed">
                {currentQ.question}
              </h4>
            </div>

            {/* 4 Multiple Choice Options */}
            <div className="space-y-2.5 sm:space-y-3 mb-4">
              {currentQ.options.map((option, oIdx) => {
                const isSelected = selectedOption === oIdx;
                const isCorrect = oIdx === currentQ.correctIndex;
                const showCorrect = isAnswered && isCorrect;
                const showWrong = isAnswered && isSelected && !isCorrect;

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelect(oIdx)}
                    disabled={isAnswered}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center justify-between border active:scale-[0.99] ${
                      showCorrect
                        ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(52,211,153,0.4)]'
                        : showWrong
                        ? 'bg-rose-950/80 border-rose-500 text-rose-200'
                        : isSelected
                        ? 'bg-indigo-600/40 border-indigo-400 text-white'
                        : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-indigo-400/60 text-slate-200 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        showCorrect
                          ? 'bg-emerald-400 text-slate-950'
                          : showWrong
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-700/80 text-slate-300'
                      }`}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span>{option}</span>
                    </div>

                    {showCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                    {showWrong && <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Bottom Question Counter */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
              <span>Rapid trivia round · 10 pts per correct answer</span>
              <span>Speed bonus active</span>
            </div>
          </div>
        )}

        {/* Results & Monetization Screen */}
        {gameState === 'gameover' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center text-center">
            
            {/* Header Trophy & Result */}
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.25, 1] }}
              transition={{ type: "spring", stiffness: 350, damping: 20 }}
              className="text-4xl sm:text-5xl mb-2"
            >
              {isPerfectScore ? '🏆' : correctCount >= 3 ? '🎉' : '💡'}
            </motion.div>

            <h3 className="text-xl sm:text-2xl font-black text-white mb-1">
              {isPerfectScore 
                ? 'Bot Defeated! Perfect Mastery!' 
                : correctCount >= 3 
                ? 'Great Effort on Beat the Bot!' 
                : 'Good Practice Session!'}
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 mb-4 max-w-sm">
              {isPerfectScore
                ? "You answered every single question correctly before the clock ran out!"
                : "You tested your rapid-fire reflexes against the AI teacher."}
            </p>

            {/* Score Stats Badge */}
            <div className="flex items-center justify-center gap-4 bg-slate-900/90 border border-indigo-500/30 px-5 py-3 rounded-2xl mb-4 shadow-lg">
              <div className="flex flex-col items-center">
                <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-300">
                  {score}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Points
                </span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div className="flex flex-col items-center">
                <span className="text-2xl sm:text-3xl font-black font-mono text-amber-300">
                  {correctCount}/{totalQuestions}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Correct
                </span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div className="flex flex-col items-center">
                <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-300">
                  {60 - timeLeft}s
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Time Taken
                </span>
              </div>
            </div>

            {/* Reward Card: 2 Free AI Searches (Only on that day, when 5 out of 5 achieved) */}
            <div className={`w-full max-w-md p-3.5 sm:p-4 rounded-2xl border mb-5 transition-all text-left ${
              isPerfectScore 
                ? 'bg-gradient-to-r from-emerald-950/80 via-teal-950/80 to-slate-900 border-emerald-400/50 shadow-[0_0_20px_rgba(52,211,153,0.2)]' 
                : 'bg-slate-900/60 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isPerfectScore ? 'bg-emerald-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                }`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className={`text-xs sm:text-sm font-black flex items-center gap-2 ${
                    isPerfectScore ? 'text-emerald-300' : 'text-slate-200'
                  }`}>
                    {isPerfectScore 
                      ? '⚡ Reward: 2 Free AI Searches Unlocked Today!' 
                      : 'Reward: Score 5/5 to Unlock 2 Free AI Searches'}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-relaxed">
                    {isPerfectScore 
                      ? 'Congratulations! You earned 2 free passes for AI Search valid for today. No credits will be deducted on your next 2 searches.' 
                      : 'Score a flawless 5 out of 5 in Beat the Bot to unlock 2 free AI Searches for today!'}
                  </p>
                </div>
              </div>
            </div>

            {/* Directly Beneath Score Summary: Dedicated Container for Adsterra 300x250 Banner Ad */}
            <div className="w-full flex flex-col items-center justify-center my-2 shrink-0">
              <p className="text-[11px] font-semibold tracking-wider text-slate-300 dark:text-slate-200 uppercase mb-2 text-center drop-shadow-sm select-none">
                📢 Sponsored Content
              </p>
              <div 
                ref={bannerContainerRef}
                id="adsterra-quiz-300x250-container"
                className="w-[300px] h-[250px] bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center relative shadow-md"
                style={{ touchAction: 'pan-y' }}
              >
                {/* Fallback while script loads */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <span>Loading Partner Content...</span>
                </div>
              </div>
            </div>

            {/* Action Buttons on Results Screen */}
            <div className="w-full max-w-md mt-4 space-y-2.5">
              {/* Primary Action Button */}
              <button
                onClick={handleClaimReward}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 hover:from-emerald-300 hover:to-cyan-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPerfectScore ? (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    <span>⚡ Claim 2 Free AI Searches & Return</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    <span>Return to Classroom</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayAgain}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors border border-slate-700 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Play Again</span>
                </button>

                {/* Secondary Monetization Button linking to Smartlink */}
                <a
                  href={TOP_UP_SMARTLINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600/80 to-purple-600/80 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-xs transition-colors border border-indigo-500/50 flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
                  <span>⚡ Top Up Credits</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
export default AiQuizGame;
