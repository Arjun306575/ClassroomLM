import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Delete, RotateCcw, Copy, Check, Calculator as CalcIcon, History } from 'lucide-react';

interface SmartCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

// Factorial helper: safely computes n! in O(n) up to n=170, returns Infinity for n > 170 in O(1)
function factorial(n: number): number {
  if (isNaN(n) || !isFinite(n) || n < 0) return NaN;
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-9) n = rounded;
  if (!Number.isInteger(n)) return NaN;
  if (n === 0 || n === 1) return 1;
  if (n > 170) return Infinity; // Prevents overflow loop & thread freeze
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
  }
  return res;
}

// Robust mathematical evaluator using Shunting-Yard algorithm and RPN
export function evaluateMath(input: string, isRad: boolean = false): string {
  if (!input || !input.trim()) return "0";

  const expr = input
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, "MathPI")
    .replace(/e(?![a-zA-Z0-9_])/g, "MathE");

  // Tokenize
  const tokens: Array<{ type: 'NUM' | 'FUNC' | 'POST_OP' | 'OP'; val: any }> = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/\d/.test(ch) || (ch === "." && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
      let numStr = "";
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      tokens.push({ type: "NUM", val: parseFloat(numStr) });
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      let ident = "";
      while (i < expr.length && /[a-zA-Z0-9]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }
      if (ident === "MathPI") tokens.push({ type: "NUM", val: Math.PI });
      else if (ident === "MathE") tokens.push({ type: "NUM", val: Math.E });
      else tokens.push({ type: "FUNC", val: ident });
      continue;
    }

    if (ch === "!") {
      tokens.push({ type: "POST_OP", val: "!" });
      i++;
      continue;
    }

    if (ch === "%") {
      tokens.push({ type: "POST_OP", val: "%" });
      i++;
      continue;
    }

    if ("+-*/^()".includes(ch)) {
      tokens.push({ type: "OP", val: ch });
      i++;
      continue;
    }

    i++;
  }

  // Insert implicit multiplication: e.g. 5(, )5, )(, 5sin, )sin, 5pi, 5!2
  const expanded: typeof tokens = [];
  for (let j = 0; j < tokens.length; j++) {
    const curr = tokens[j];
    const prev = tokens[j - 1];
    if (prev) {
      const prevCanMultiply = prev.type === "NUM" || (prev.type === "OP" && prev.val === ")") || prev.type === "POST_OP";
      const currCanMultiply = curr.type === "NUM" || curr.type === "FUNC" || (curr.type === "OP" && curr.val === "(");
      if (prevCanMultiply && currCanMultiply) {
        expanded.push({ type: "OP", val: "*" });
      }
    }
    expanded.push(curr);
  }

  // Auto-balance open parentheses
  let openParenCount = 0;
  for (const t of expanded) {
    if (t.type === "OP" && t.val === "(") openParenCount++;
    if (t.type === "OP" && t.val === ")") openParenCount--;
  }
  for (let p = 0; p < openParenCount; p++) {
    expanded.push({ type: "OP", val: ")" });
  }

  // Shunting-Yard to convert Infix to RPN (Reverse Polish Notation)
  const outputQueue: typeof tokens = [];
  const opStack: typeof tokens = [];

  const precedence: Record<string, number> = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2,
    "NEG": 3,
    "^": 4
  };

  const associativity: Record<string, 'L' | 'R'> = {
    "+": "L",
    "-": "L",
    "*": "L",
    "/": "L",
    "NEG": "R",
    "^": "R"
  };

  for (let k = 0; k < expanded.length; k++) {
    const tok = expanded[k];
    const prev = expanded[k - 1];

    if (tok.type === "NUM") {
      outputQueue.push(tok);
    } else if (tok.type === "FUNC") {
      opStack.push(tok);
    } else if (tok.type === "POST_OP") {
      outputQueue.push(tok);
    } else if (tok.type === "OP") {
      if (tok.val === "(") {
        opStack.push(tok);
      } else if (tok.val === ")") {
        while (opStack.length && opStack[opStack.length - 1].val !== "(") {
          outputQueue.push(opStack.pop()!);
        }
        if (opStack.length && opStack[opStack.length - 1].val === "(") {
          opStack.pop();
        }
        if (opStack.length && opStack[opStack.length - 1].type === "FUNC") {
          outputQueue.push(opStack.pop()!);
        }
      } else {
        let opVal = tok.val;
        // Distinguish unary minus (NEG) from binary subtraction
        if (opVal === "-" && (!prev || (prev.type === "OP" && prev.val !== ")"))) {
          opVal = "NEG";
        } else if (opVal === "+" && (!prev || (prev.type === "OP" && prev.val !== ")"))) {
          continue; // Unary plus is a no-op
        }

        while (
          opStack.length &&
          opStack[opStack.length - 1].val !== "(" &&
          ((associativity[opVal] === "L" && precedence[opVal] <= precedence[opStack[opStack.length - 1].val]) ||
           (associativity[opVal] === "R" && precedence[opVal] < precedence[opStack[opStack.length - 1].val]))
        ) {
          outputQueue.push(opStack.pop()!);
        }
        opStack.push({ type: "OP", val: opVal });
      }
    }
  }

  while (opStack.length) {
    const top = opStack.pop()!;
    if (top.val !== "(") outputQueue.push(top);
  }

  // Evaluate RPN Stack
  const stack: number[] = [];
  for (const item of outputQueue) {
    if (item.type === "NUM") {
      stack.push(item.val);
    } else if (item.type === "POST_OP") {
      const a = stack.pop();
      if (a === undefined) return "Error";
      if (item.val === "!") {
        stack.push(factorial(a));
      } else if (item.val === "%") {
        stack.push(a / 100);
      }
    } else if (item.type === "FUNC") {
      const a = stack.pop();
      if (a === undefined) return "Error";
      const rad = isRad ? a : (a * Math.PI) / 180;
      switch (item.val) {
        case "sin": {
          if (!isRad && ((Math.abs(a) % 180 === 0))) {
            stack.push(0);
          } else {
            stack.push(Math.sin(rad));
          }
          break;
        }
        case "cos": {
          if (!isRad && (Math.abs(a % 180) === 90)) {
            stack.push(0);
          } else {
            stack.push(Math.cos(rad));
          }
          break;
        }
        case "tan": {
          if (!isRad && (Math.abs(a % 180) === 90)) return "Undefined";
          stack.push(Math.tan(rad));
          break;
        }
        case "sqrt": {
          if (a < 0) return "Math Error";
          stack.push(Math.sqrt(a));
          break;
        }
        case "ln": {
          if (a <= 0) return "Math Error";
          stack.push(Math.log(a));
          break;
        }
        case "log": {
          if (a <= 0) return "Math Error";
          stack.push(Math.log10(a));
          break;
        }
        case "abs": stack.push(Math.abs(a)); break;
        default: return "Error";
      }
    } else if (item.type === "OP") {
      if (item.val === "NEG") {
        const a = stack.pop();
        if (a === undefined) return "Error";
        stack.push(-a);
      } else {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) return "Error";
        switch (item.val) {
          case "+": stack.push(a + b); break;
          case "-": stack.push(a - b); break;
          case "*": stack.push(a * b); break;
          case "/": {
            // Strict division by zero detection
            if (b === 0 || Math.abs(b) < 1e-15) {
              return "Cannot divide by zero";
            }
            stack.push(a / b);
            break;
          }
          case "^": stack.push(Math.pow(a, b)); break;
          default: return "Error";
        }
      }
    }
  }

  if (stack.length !== 1) return "Error";
  const res = stack[0];
  if (res === Infinity || res === -Infinity) return "Infinity";
  if (isNaN(res)) return "Math Error";
  const rounded = Math.round(res * 1e10) / 1e10;
  return rounded.toString();
}

// Live preview helper: safely evaluates current or prefix expression while user is typing
function getLivePreview(expr: string, isRad: boolean): string {
  if (!expr || !expr.trim()) return "0";

  // Check direct evaluation first
  const direct = evaluateMath(expr, isRad);
  if (direct !== "Error" && direct !== "Math Error") {
    return direct;
  }

  // Strip trailing operators/functions if user is mid-typing (e.g. "5 +", "5 ÷", "sin(")
  let trimmed = expr.trim();
  while (/[+\-*/^÷×−(,]$/.test(trimmed)) {
    trimmed = trimmed.replace(/[+\-*/^÷×−(,]$/, '').trim();
    trimmed = trimmed.replace(/(sin|cos|tan|sqrt|ln|log|abs)$/, '').trim();
  }

  if (!trimmed) return "0";
  const trimmedRes = evaluateMath(trimmed, isRad);
  if (trimmedRes !== "Error" && trimmedRes !== "Math Error") {
    return trimmedRes;
  }
  return "0";
}

export function SmartCalculator({ isOpen, onClose, isDarkMode }: SmartCalculatorProps) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [justCalculated, setJustCalculated] = useState(false);
  // Session-only in-memory history: strictly never saved to Saved Content or Firestore
  const [history, setHistory] = useState<Array<{ expr: string; res: string }>>([]);
  const [isRad, setIsRad] = useState(false);
  const [isScientific, setIsScientific] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  // Update live preview when expression changes
  useEffect(() => {
    if (!expression) {
      setResult("0");
      return;
    }
    const preview = getLivePreview(expression, isRad);
    setResult(preview);
  }, [expression, isRad]);

  const handleInput = (val: string) => {
    // If previous calculation just finished with =
    if (justCalculated) {
      setJustCalculated(false);
      // If previous result was an error or division by zero, start completely fresh
      if (result === "Cannot divide by zero" || result === "Error" || result === "Math Error" || result === "Undefined") {
        setExpression(val);
        return;
      }
      // If user presses an operator or power/factorial/percent, chain off previous result!
      if (['+', '−', '×', '÷', '^', '%', '!'].includes(val)) {
        setExpression(expression + val);
        return;
      }
      // If user typed a new number or function, start a brand new calculation
      setExpression(val);
      return;
    }

    setExpression(prev => prev + val);
  };

  const handleClear = () => {
    setExpression("");
    setResult("0");
    setJustCalculated(false);
  };

  const handleBackspace = () => {
    if (justCalculated) {
      setJustCalculated(false);
    }
    setExpression(prev => {
      if (prev.length <= 1) {
        setResult("0");
        return "";
      }
      return prev.slice(0, -1);
    });
  };

  // Toggle +/- on the trailing number
  const handleToggleSign = () => {
    setExpression(prev => {
      if (!prev) return "-";
      const match = prev.match(/(-?\d+\.?\d*)$/);
      if (match) {
        const num = match[1];
        const toggled = num.startsWith('-') ? num.slice(1) : '-' + num;
        return prev.slice(0, prev.length - num.length) + toggled;
      }
      return prev + "(-";
    });
  };

  const handleEquals = () => {
    if (!expression.trim()) return;
    const finalRes = evaluateMath(expression, isRad);
    setResult(finalRes);
    setJustCalculated(true);
    if (finalRes !== "Error" && finalRes !== "Math Error" && finalRes !== "Cannot divide by zero" && finalRes !== "Undefined") {
      // History is stored in React memory only for this session.
      // Strict rule: NEVER saved in Saved Content or Firestore!
      setHistory(prev => [{ expr: expression, res: finalRes }, ...prev.slice(0, 24)]);
      setExpression(finalRes);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Keyboard navigation support for desktop students
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key >= '0' && e.key <= '9') {
        handleInput(e.key);
      } else if (e.key === '.' || e.key === '+' || e.key === '-' || e.key === '(' || e.key === ')') {
        handleInput(e.key === '-' ? '−' : e.key);
      } else if (e.key === '*') {
        handleInput('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleInput('÷');
      } else if (e.key === '%') {
        handleInput('%');
      } else if (e.key === '^') {
        handleInput('^');
      } else if (e.key === '!') {
        handleInput('!');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'c' || e.key === 'C') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, expression, isRad, justCalculated, result]);

  if (!isOpen) return null;

  const isErrorState = result === "Cannot divide by zero" || result === "Error" || result === "Math Error" || result === "Undefined";

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md select-none"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.92, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-md sm:max-w-lg rounded-3xl p-4 sm:p-6 shadow-2xl border flex flex-col gap-3.5 sm:gap-4 relative overflow-hidden transition-colors ${
            isDarkMode 
              ? 'bg-slate-900/98 border-emerald-500/40 text-white shadow-[0_0_50px_rgba(16,185,129,0.25)]' 
              : 'bg-white border-2 border-slate-200 text-slate-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)]'
          }`}
        >
          {/* Top Rainbow Accent Strip */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" />

          {/* Header */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-black shadow-md shadow-emerald-500/30 shrink-0">
                <CalcIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`font-black text-base sm:text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Smart Calculator
                  </h3>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}>
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    FREE · 0 CREDITS
                  </span>
                </div>
                <p className={`text-[10px] sm:text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Free of credits · Session only · Not saved to Saved Content
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* History Toggle */}
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-xl border transition-all ${
                  showHistory 
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 shadow-sm' 
                    : isDarkMode 
                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' 
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                }`}
                title="Session History (In-Memory Only)"
              >
                <History className="w-4 h-4" />
              </button>

              {/* Close Button */}
              <button 
                type="button"
                onClick={onClose}
                className={`p-2 rounded-xl transition-all border ${
                  isDarkMode 
                    ? 'hover:bg-slate-800 border-transparent text-slate-400 hover:text-white' 
                    : 'hover:bg-slate-100 border-transparent text-slate-600 hover:text-slate-900'
                }`}
                title="Close Calculator"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Calculator Screen / Display - Fresh OLED Curved Display */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-end min-h-[112px] shadow-inner relative overflow-hidden transition-colors ${
            isDarkMode 
              ? 'bg-[#080d18] border-emerald-500/30 shadow-[inset_0_2px_16px_rgba(0,0,0,0.8)]' 
              : 'bg-slate-100 border-2 border-slate-300/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)]'
          }`}>
            {/* Subtle OLED grid line scan effect */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px]" />

            {/* Expression line */}
            <div className={`text-right text-xs sm:text-sm font-mono font-semibold overflow-x-auto whitespace-nowrap scrollbar-none mb-1.5 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {expression || "0"}
            </div>

            {/* Current Result line */}
            <div className="flex items-center justify-between gap-2 z-10">
              <button
                type="button"
                onClick={handleCopy}
                className={`p-1.5 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all font-bold active:scale-95 ${
                  copied 
                    ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                    : isDarkMode 
                    ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white' 
                    : 'bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-800 shadow-sm'
                }`}
                title="Copy result"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-bold">{copied ? "Copied" : "Copy"}</span>
              </button>

              <div className={`text-right font-black font-mono tracking-tight overflow-x-auto whitespace-nowrap scrollbar-none transition-colors ${
                isErrorState
                  ? 'text-rose-500 text-base sm:text-lg'
                  : isDarkMode
                  ? 'text-emerald-400 text-2xl sm:text-3xl drop-shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                  : 'text-emerald-700 text-2xl sm:text-3xl'
              }`}>
                {result}
              </div>
            </div>
          </div>

          {/* Session History Drawer (In-Memory Only) */}
          <AnimatePresence>
            {showHistory && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={`overflow-hidden rounded-2xl border p-3 flex flex-col gap-2 max-h-40 overflow-y-auto text-xs ${
                  isDarkMode ? 'bg-slate-950/95 border-slate-800' : 'bg-slate-50 border-2 border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-800">
                  <span className={`font-bold text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Session History (In-Memory Only)</span>
                  {history.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => setHistory([])}
                      className="text-[10px] text-rose-500 hover:underline flex items-center gap-0.5 font-bold"
                    >
                      <RotateCcw className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
                {history.length === 0 ? (
                  <p className={`text-center py-2 text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>No calculations in this session yet</p>
                ) : (
                  history.map((h, i) => (
                    <div 
                      key={i}
                      onClick={() => {
                        setExpression(h.res);
                        setResult(h.res);
                      }}
                      className={`flex justify-between items-center p-1.5 rounded-lg cursor-pointer font-mono transition-colors ${
                        isDarkMode ? 'hover:bg-emerald-500/10' : 'hover:bg-emerald-50 bg-white border border-slate-200'
                      }`}
                      title="Click to use result"
                    >
                      <span className={`truncate max-w-[60%] ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>{h.expr} =</span>
                      <span className={`font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{h.res}</span>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scientific vs Standard Mode Selector */}
          <div className="flex justify-between items-center text-xs">
            <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-white/10' : 'bg-slate-200/90 border border-slate-300'}`}>
              <button
                type="button"
                onClick={() => setIsRad(false)}
                className={`px-2.5 py-0.5 rounded-lg font-black text-[10px] transition-all ${
                  !isRad ? 'bg-emerald-600 text-white shadow-sm' : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-950 font-bold'
                }`}
              >
                DEG
              </button>
              <button
                type="button"
                onClick={() => setIsRad(true)}
                className={`px-2.5 py-0.5 rounded-lg font-black text-[10px] transition-all ${
                  isRad ? 'bg-emerald-600 text-white shadow-sm' : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-950 font-bold'
                }`}
              >
                RAD
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsScientific(!isScientific)}
              className={`text-[11px] font-bold px-3 py-1 rounded-xl border transition-all ${
                isScientific 
                  ? isDarkMode ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-950 border-2 border-cyan-400 font-black shadow-sm'
                  : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-300 font-bold'
              }`}
            >
              {isScientific ? 'Scientific Mode' : 'Standard Mode'}
            </button>
          </div>

          {/* Keypad Grid with Dedicated High-Contrast Tray */}
          <div className={`flex flex-col gap-2 p-2 sm:p-2.5 rounded-3xl border ${
            isDarkMode ? 'bg-slate-950/50 border-white/5' : 'bg-slate-100/90 border-2 border-slate-200/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)]'
          }`}>
            {/* Scientific Function Row */}
            {isScientific && (
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {[
                  { label: 'sin', val: 'sin(' },
                  { label: 'cos', val: 'cos(' },
                  { label: 'tan', val: 'tan(' },
                  { label: '√', val: 'sqrt(' },
                  { label: 'xʸ', val: '^' },
                  { label: 'ln', val: 'ln(' },
                  { label: 'log', val: 'log(' },
                  { label: 'π', val: 'π' },
                  { label: 'e', val: 'e' },
                  { label: 'x!', val: '!' },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInput(btn.val)}
                    className={`py-2 rounded-xl text-xs font-black transition-all border active:scale-95 ${
                      isDarkMode 
                        ? 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-cyan-300' 
                        : 'bg-cyan-50 hover:bg-cyan-100 active:bg-cyan-200 border-2 border-cyan-300 text-cyan-950 font-black shadow-sm'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}

            {/* Standard Keypad - High Contrast and Distinct in Both Modes */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {/* Row 1 */}
              <button
                type="button"
                onClick={handleClear}
                className={`py-3 sm:py-3.5 rounded-2xl text-sm font-black active:scale-95 transition-all border ${
                  isDarkMode 
                    ? 'bg-rose-500/25 hover:bg-rose-500/35 text-rose-300 border-rose-500/40' 
                    : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white border-2 border-rose-700 shadow-md shadow-rose-600/30'
                }`}
                title="Clear (C)"
              >
                AC
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className={`py-3 sm:py-3.5 rounded-2xl text-sm font-black border active:scale-95 transition-all flex items-center justify-center ${
                  isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' 
                    : 'bg-slate-200 hover:bg-slate-300 active:bg-slate-400 border-2 border-slate-400/80 text-slate-950 shadow-sm'
                }`}
                title="Backspace (⌫)"
              >
                <Delete className="w-4 h-4 stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={handleToggleSign}
                className={`py-3 sm:py-3.5 rounded-2xl text-sm font-black border active:scale-95 transition-all ${
                  isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' 
                    : 'bg-slate-200 hover:bg-slate-300 active:bg-slate-400 border-2 border-slate-400/80 text-slate-950 shadow-sm'
                }`}
                title="Toggle Sign (+/-)"
              >
                ±
              </button>
              <button 
                type="button" 
                onClick={() => handleInput('÷')} 
                className={`py-3 sm:py-3.5 rounded-2xl text-lg font-black active:scale-95 transition-all border ${
                  isDarkMode 
                    ? 'bg-indigo-600/30 hover:bg-indigo-600/40 active:bg-indigo-600/50 text-indigo-200 border-indigo-500/40 shadow-sm' 
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white border-2 border-indigo-700 shadow-md shadow-indigo-600/30'
                }`}
                title="Divide (/)"
              >
                ÷
              </button>

              {/* Row 2 */}
              <button type="button" onClick={() => handleInput('7')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>7</button>
              <button type="button" onClick={() => handleInput('8')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>8</button>
              <button type="button" onClick={() => handleInput('9')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>9</button>
              <button 
                type="button" 
                onClick={() => handleInput('×')} 
                className={`py-3 sm:py-3.5 rounded-2xl text-lg font-black active:scale-95 transition-all border ${
                  isDarkMode 
                    ? 'bg-indigo-600/30 hover:bg-indigo-600/40 active:bg-indigo-600/50 text-indigo-200 border-indigo-500/40 shadow-sm' 
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white border-2 border-indigo-700 shadow-md shadow-indigo-600/30'
                }`}
                title="Multiply (*)"
              >
                ×
              </button>

              {/* Row 3 */}
              <button type="button" onClick={() => handleInput('4')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>4</button>
              <button type="button" onClick={() => handleInput('5')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>5</button>
              <button type="button" onClick={() => handleInput('6')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>6</button>
              <button 
                type="button" 
                onClick={() => handleInput('−')} 
                className={`py-3 sm:py-3.5 rounded-2xl text-lg font-black active:scale-95 transition-all border ${
                  isDarkMode 
                    ? 'bg-indigo-600/30 hover:bg-indigo-600/40 active:bg-indigo-600/50 text-indigo-200 border-indigo-500/40 shadow-sm' 
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white border-2 border-indigo-700 shadow-md shadow-indigo-600/30'
                }`}
                title="Subtract (-)"
              >
                −
              </button>

              {/* Row 4 */}
              <button type="button" onClick={() => handleInput('1')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>1</button>
              <button type="button" onClick={() => handleInput('2')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>2</button>
              <button type="button" onClick={() => handleInput('3')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>3</button>
              <button 
                type="button" 
                onClick={() => handleInput('+')} 
                className={`py-3 sm:py-3.5 rounded-2xl text-lg font-black active:scale-95 transition-all border ${
                  isDarkMode 
                    ? 'bg-indigo-600/30 hover:bg-indigo-600/40 active:bg-indigo-600/50 text-indigo-200 border-indigo-500/40 shadow-sm' 
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white border-2 border-indigo-700 shadow-md shadow-indigo-600/30'
                }`}
                title="Add (+)"
              >
                +
              </button>

              {/* Row 5 */}
              <button type="button" onClick={() => handleInput('0')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>0</button>
              <button type="button" onClick={() => handleInput('.')} className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white font-bold' : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300/90 text-slate-950 font-black shadow-[0_2px_4px_rgba(0,0,0,0.06)]'}`}>.</button>
              <button
                type="button"
                onClick={handleEquals}
                className="py-3 sm:py-3.5 rounded-2xl text-base font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white shadow-md shadow-emerald-600/30 transition-all border-2 border-emerald-700 dark:border-emerald-400/50"
                title="Equals (Enter)"
              >
                =
              </button>
              <button 
                type="button" 
                onClick={() => handleInput('%')} 
                className={`py-3 sm:py-3.5 rounded-2xl text-base border active:scale-95 transition-all ${
                  isDarkMode 
                    ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-amber-300 font-bold' 
                    : 'bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border-2 border-amber-400/90 text-amber-950 font-black shadow-sm'
                }`}
                title="Percentage (%)"
              >
                %
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
