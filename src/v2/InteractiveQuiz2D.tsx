import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, XCircle, HelpCircle, RotateCcw, 
  Sparkles, Award, ArrowRight, Loader2, BookOpen, RefreshCw
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import { QuizQuestion } from '../types';

interface InteractiveQuiz2DProps {
  questions: QuizQuestion[];
  isLoading: boolean;
  topic: string;
  isDarkMode?: boolean;
  onSubmitQuiz: (score: number, total: number) => void;
  onRetakeQuiz: () => void;
  onGenerateFreshQuiz?: () => void;
  onReturnToSlides: () => void;
}

export function InteractiveQuiz2D({
  questions,
  isLoading,
  topic,
  isDarkMode = true,
  onSubmitQuiz,
  onRetakeQuiz,
  onGenerateFreshQuiz,
  onReturnToSlides
}: InteractiveQuiz2DProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;

  const handleSelectOption = (qIdx: number, oIdx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  };

  const handleSubmit = () => {
    if (!allAnswered || isSubmitted) return;
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correctCount++;
      }
    });
    setScore(correctCount);
    setIsSubmitted(true);
    onSubmitQuiz(correctCount, totalQuestions);

    // Launch celebratory confetti burst
    try {
      confetti({
        particleCount: correctCount === totalQuestions ? 100 : 65,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // safe fallback if canvas confetti not supported in current environment
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setScore(0);
    onRetakeQuiz();
  };

  const handleFreshQuiz = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setScore(0);
    if (onGenerateFreshQuiz) {
      onGenerateFreshQuiz();
    } else {
      onRetakeQuiz();
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full rounded-3xl bg-[#0f172a] border-4 border-slate-700/80 shadow-2xl p-6 sm:p-10 flex flex-col items-center justify-center text-center">
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
          <Sparkles className="absolute inset-0 m-auto w-7 h-7 text-cyan-300 animate-pulse" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide mb-2">
          Generating Fresh Lesson Quiz...
        </h3>
        <p className="text-sm text-cyan-200/80 max-w-md">
          Synthesizing 3–5 personalized assessment questions based on the lesson explained for &ldquo;{topic}&rdquo;.
        </p>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="w-full h-full rounded-3xl bg-[#0f172a] border-4 border-slate-700/80 shadow-2xl p-6 sm:p-10 flex flex-col items-center justify-center text-center">
        <HelpCircle className="w-14 h-14 text-amber-400 mb-4 animate-bounce" />
        <h3 className="text-xl font-bold text-white mb-2">Quiz Questions Loading</h3>
        <p className="text-sm text-slate-300 mb-6 max-w-sm">
          No questions found for this topic yet. Click below to generate a fresh quiz.
        </p>
        <button
          onClick={handleRetake}
          className="px-6 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
          Generate Fresh Quiz
        </button>
      </div>
    );
  }

  const scorePercentage = Math.round((score / totalQuestions) * 100);

  return (
    <div className="w-full h-full rounded-3xl bg-[#0f172a] border-4 border-slate-700/90 shadow-2xl flex flex-col overflow-hidden relative">
      {/* Quiz Top Header Bar */}
      <div className="px-4 sm:px-6 py-3.5 bg-slate-900/90 border-b border-slate-700/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
            <Award className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-white tracking-wide truncate">
              {topic} · Mastery Quiz
            </h2>
            <p className="text-[11px] text-cyan-300/80 font-medium">
              {isSubmitted 
                ? `Completed · Score: ${score}/${totalQuestions} (${scorePercentage}%)`
                : `${totalQuestions} Questions · Answered ${answeredCount} of ${totalQuestions}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onReturnToSlides}
            className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Review lesson slides"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Review Slides</span>
          </button>
        </div>
      </div>

      {/* Score Summary Banner (When Submitted) */}
      <AnimatePresence>
        {isSubmitted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`px-4 sm:px-6 py-3.5 border-b shrink-0 flex items-center justify-between gap-3 ${
              score === totalQuestions
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                : score >= totalQuestions * 0.7
                ? 'bg-cyan-950/70 border-cyan-500/40 text-cyan-200'
                : 'bg-amber-950/70 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl sm:text-3xl">
                {score === totalQuestions ? '🏆' : score >= totalQuestions * 0.7 ? '🎉' : '💡'}
              </span>
              <div>
                <p className="text-xs sm:text-sm font-black">
                  {score === totalQuestions
                    ? 'Perfect Score! 100% Mastery!'
                    : score >= totalQuestions * 0.7
                    ? 'Great Work! Solid Understanding!'
                    : 'Good Effort! Review Explanations Below!'}
                </p>
                <p className="text-[11px] opacity-80 font-medium">
                  You scored {score} out of {totalQuestions} ({scorePercentage}%). Review detailed answer explanations below.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRetake}
                className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-white/20 shrink-0"
                title="Clear answers and try again"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>
              {onGenerateFreshQuiz && (
                <button
                  onClick={handleFreshQuiz}
                  className="px-3.5 py-1.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-cyan-400/40 shrink-0"
                  title="Generate a brand new set of questions"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Fresh Questions</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable Questions Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 scroll-smooth">
        {questions.map((q, qIdx) => {
          const userAns = selectedAnswers[qIdx];
          const hasAnsweredThis = userAns !== undefined;
          const isCorrect = isSubmitted && userAns === q.correctIndex;
          const isWrong = isSubmitted && userAns !== undefined && userAns !== q.correctIndex;

          return (
            <motion.div
              key={qIdx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: qIdx * 0.08 }}
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                isSubmitted
                  ? isCorrect
                    ? 'bg-emerald-950/30 border-emerald-500/40'
                    : 'bg-rose-950/30 border-rose-500/40'
                  : 'bg-slate-800/50 border-slate-700/80 hover:border-slate-600'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start gap-3 mb-3.5">
                <span className={`px-2 py-0.5 rounded-md text-xs font-black shrink-0 ${
                  isSubmitted
                    ? isCorrect
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                    : 'bg-indigo-600 text-white'
                }`}>
                  Q{qIdx + 1}
                </span>

                <div className="flex-1 min-w-0 text-sm sm:text-base font-bold text-white leading-snug">
                  <Markdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {q.question}
                  </Markdown>
                </div>

                {isSubmitted && (
                  <div className="shrink-0">
                    {isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                  </div>
                )}
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {q.options.map((opt, oIdx) => {
                  const isSelected = userAns === oIdx;
                  const isRightAnswer = q.correctIndex === oIdx;

                  let optionStyles = 'bg-slate-900/80 border-slate-700 hover:border-cyan-500/60 hover:bg-slate-800 text-slate-200';

                  if (isSubmitted) {
                    if (isRightAnswer) {
                      optionStyles = 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]';
                    } else if (isSelected && !isRightAnswer) {
                      optionStyles = 'bg-rose-500/20 border-rose-400 text-rose-200 line-through';
                    } else {
                      optionStyles = 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60';
                    }
                  } else if (isSelected) {
                    optionStyles = 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold shadow-[0_0_12px_rgba(34,211,238,0.3)] ring-1 ring-cyan-400';
                  }

                  const optionLetter = String.fromCharCode(65 + oIdx);

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() => handleSelectOption(qIdx, oIdx)}
                      className={`min-h-[46px] p-3 rounded-xl border text-left text-xs sm:text-sm flex items-center gap-3 transition-all active:scale-[0.98] ${optionStyles}`}
                    >
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                        isSubmitted && isRightAnswer
                          ? 'bg-emerald-500 text-slate-950'
                          : isSelected
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {optionLetter}
                      </span>
                      <span className="flex-1 min-w-0 break-words leading-tight">
                        {opt}
                      </span>
                      {isSubmitted && isRightAnswer && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation (Shown when submitted) */}
              {isSubmitted && q.explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3.5 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-300 leading-relaxed"
                >
                  <span className="font-bold text-cyan-300 mr-1.5">💡 Explanation:</span>
                  <Markdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {q.explanation}
                  </Markdown>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Bottom Sticky Action Bar: Submit Quiz */}
      <div className="p-4 sm:p-5 bg-slate-900/95 border-t border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
        <div className="text-xs text-slate-400 font-medium hidden sm:block">
          {isSubmitted ? (
            <span>Quiz completed. Great job reviewing this lesson!</span>
          ) : (
            <span>
              {allAnswered 
                ? 'All questions answered! Click submit when ready.' 
                : `Please answer all questions (${answeredCount}/${totalQuestions})`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto w-full sm:w-auto justify-end">
          {!isSubmitted ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered}
              className={`w-full sm:w-auto px-7 py-3 rounded-full font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 ${
                allAnswered
                  ? 'bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-slate-950 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.6)] animate-pulse'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <span>Submit Quiz ({answeredCount}/{totalQuestions})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border border-slate-700 active:scale-95"
                title="Reset answers to practice again"
              >
                <RotateCcw className="w-4 h-4 text-cyan-400" />
                <span>Retake</span>
              </button>
              {onGenerateFreshQuiz && (
                <button
                  type="button"
                  onClick={handleFreshQuiz}
                  className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-full bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border border-indigo-500/60 active:scale-95 shadow-md"
                  title="Generate a brand new set of 3-5 questions"
                >
                  <RefreshCw className="w-4 h-4 text-cyan-300" />
                  <span>Fresh Quiz</span>
                </button>
              )}
              <button
                type="button"
                onClick={onReturnToSlides}
                className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                <BookOpen className="w-4 h-4" />
                <span>Review Slides</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
