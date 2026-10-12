import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface TeacherMascot2DProps {
  pose?: string;
  isSpeaking: boolean;
  analyserRef?: React.RefObject<AnalyserNode | null>;
}

/**
 * Blue Smiling Face & Viseme Mouth:
 * - Shows a sweet curved blue smile when idle/listening
 * - Expressively animates and speaks in electric blue whenever TTS audio plays
 */
const BlueSmileMouth = ({
  isSpeaking,
  analyserRef,
}: {
  isSpeaking: boolean;
  analyserRef?: React.RefObject<AnalyserNode | null>;
}) => {
  const [mouthScale, setMouthScale] = useState(1);
  const [mouthHeight, setMouthHeight] = useState(6);
  const [mouthWidth, setMouthWidth] = useState(24);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      timeRef.current += dt;

      if (isSpeaking) {
        let energy = 0;
        if (analyserRef?.current) {
          try {
            const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(freqData);
            let sum = 0;
            const count = Math.min(freqData.length, 32);
            for (let i = 1; i < count; i++) {
              sum += freqData[i];
            }
            energy = sum / (count - 1) / 255;
          } catch (e) {}
        }

        if (energy < 0.02) {
          const w1 = Math.sin(timeRef.current * 20) * 0.5 + 0.5;
          const w2 = Math.sin(timeRef.current * 10) * 0.3 + 0.7;
          energy = Math.max(0.2, w1 * w2);
        }

        const h = Math.round(7 + energy * 13);
        const w = Math.round(22 + energy * 10);
        setMouthHeight(h);
        setMouthWidth(w);
        setMouthScale(1 + energy * 0.15);
      } else {
        setMouthHeight(6);
        setMouthWidth(24);
        setMouthScale(1);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isSpeaking, analyserRef]);

  return (
    <div className="flex items-center justify-center h-7 w-full select-none">
      {isSpeaking ? (
        // Active speaking blue mouth animated to speech audio
        <div 
          className="flex items-center justify-center transition-[height,width] duration-75 relative"
          style={{ width: `${mouthWidth}px`, height: `${mouthHeight}px`, transform: `scale(${mouthScale})` }}
        >
          {/* Glowing electric blue speaking aperture */}
          <div className="w-full h-full rounded-full bg-blue-950 border-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.95)] flex items-center justify-center px-1 overflow-hidden">
            {/* Animated blue speech wave bars */}
            <div className="w-1.5 h-[65%] bg-cyan-300 rounded-full animate-pulse shadow-[0_0_6px_rgba(56,189,248,1)] mr-0.5" />
            <div className="w-2 h-[90%] bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,1)]" />
            <div className="w-1.5 h-[65%] bg-cyan-300 rounded-full animate-pulse shadow-[0_0_6px_rgba(56,189,248,1)] ml-0.5" />
          </div>
        </div>
      ) : (
        // Gentle, glowing blue smiling face arc when idle
        <svg width="30" height="14" viewBox="0 0 30 14" className="overflow-visible">
          <path
            d="M 5 4 Q 15 14 25 4"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3.2"
            strokeLinecap="round"
            className="filter drop-shadow-[0_0_8px_rgba(56,189,248,0.95)]"
          />
          <circle cx="5" cy="4" r="1.6" fill="#38bdf8" />
          <circle cx="25" cy="4" r="1.6" fill="#38bdf8" />
        </svg>
      )}
    </div>
  );
};

/**
 * 2D AI Teacher for Classroom Lessons:
 * - Shows ONLY blue smile face (speaking whenever the TTS audio plays)
 * - Blue blinking eyes
 * - Hands cleanly joined to the body
 * - Minimalist, pristine, and zero clutter
 */
export function TeacherMascot2D({
  pose = 'happy',
  isSpeaking = false,
  analyserRef,
}: TeacherMascot2DProps) {
  // Natural eye blinking timer
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 130);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  const eyeScaleY = isBlinking ? 0.12 : 1;

  return (
    <div className="relative flex flex-col items-center justify-end select-none w-full max-w-[200px] h-full pb-2">
      {/* Gentle Floating Levitation */}
      <motion.div
        animate={{
          y: [-4, 4, -4],
        }}
        transition={{
          repeat: Infinity,
          duration: 3.5,
          ease: 'easeInOut',
        }}
        className="relative flex flex-col items-center"
      >
        {/* Main Body Capsule (Glossy Pearl White) */}
        <div 
          className="relative w-32 sm:w-36 md:w-40 h-44 sm:h-48 md:h-52 rounded-[3.2rem] flex flex-col items-center pt-3 pb-4 shadow-[0_12px_28px_rgba(0,0,0,0.25),inset_0_4px_8px_rgba(255,255,255,0.9),inset_0_-8px_16px_rgba(203,213,225,0.6)]"
          style={{
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 55%, #E2E8F0 100%)',
            border: '2px solid rgba(226, 232, 240, 0.95)',
          }}
        >
          {/* Subtle glossy top specular highlight */}
          <div className="absolute top-2 inset-x-8 h-4 bg-gradient-to-b from-white/90 to-transparent rounded-full pointer-events-none" />

          {/* Left Hand / Arm (Joined directly to the body flank) */}
          <div 
            className="absolute -left-3 top-16 sm:top-20 w-4 h-16 sm:h-18 rounded-full shadow-md flex flex-col items-center justify-end pb-1"
            style={{
              background: 'linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%)',
              border: '1.5px solid rgba(203, 213, 225, 0.9)',
            }}
          >
            {/* Hand joined snugly to flank */}
            <div className="w-3.5 h-4 rounded-full bg-white border border-slate-300 shadow-inner" />
          </div>

          {/* Right Hand / Arm (Joined directly to the body flank) */}
          <div 
            className="absolute -right-3 top-16 sm:top-20 w-4 h-16 sm:h-18 rounded-full shadow-md flex flex-col items-center justify-end pb-1"
            style={{
              background: 'linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%)',
              border: '1.5px solid rgba(203, 213, 225, 0.9)',
            }}
          >
            {/* Hand joined snugly to flank */}
            <div className="w-3.5 h-4 rounded-full bg-white border border-slate-300 shadow-inner" />
          </div>

          {/* Dark Glossy Visor Screen */}
          <div 
            className="w-[84%] h-[56%] rounded-[2.2rem] flex flex-col items-center justify-center p-2.5 relative overflow-hidden shadow-[inset_0_4px_12px_rgba(0,0,0,0.9),0_0_12px_rgba(56,189,248,0.25)] border border-blue-950/70"
            style={{
              background: 'radial-gradient(ellipse at 50% 30%, #0c1a30 0%, #030712 100%)'
            }}
          >
            {/* Specular glass reflection */}
            <div className="absolute top-1 inset-x-4 h-3 bg-gradient-to-b from-white/30 via-white/10 to-transparent rounded-full pointer-events-none" />

            {/* Glowing Blue Blinking Eyes */}
            <div className="flex items-center justify-center gap-5 z-10 w-full mb-1">
              {/* Left Blue Eye */}
              <motion.div
                animate={{
                  scaleY: eyeScaleY,
                }}
                className="w-5 sm:w-6 h-6 sm:h-7 relative flex items-center justify-center"
              >
                <svg viewBox="0 0 24 28" className="w-full h-full overflow-visible drop-shadow-[0_0_10px_rgba(56,189,248,1)]">
                  <rect
                    x="2"
                    y="3"
                    width="20"
                    height="22"
                    rx="9"
                    fill="#38bdf8"
                  />
                  {/* Eye pupil glint */}
                  <ellipse cx="8" cy="9" rx="2" ry="3" fill="#ffffff" />
                </svg>
              </motion.div>

              {/* Right Blue Eye */}
              <motion.div
                animate={{
                  scaleY: eyeScaleY,
                }}
                className="w-5 sm:w-6 h-6 sm:h-7 relative flex items-center justify-center"
              >
                <svg viewBox="0 0 24 28" className="w-full h-full overflow-visible drop-shadow-[0_0_10px_rgba(56,189,248,1)]">
                  <rect
                    x="2"
                    y="3"
                    width="20"
                    height="22"
                    rx="9"
                    fill="#38bdf8"
                  />
                  {/* Eye pupil glint */}
                  <ellipse cx="8" cy="9" rx="2" ry="3" fill="#ffffff" />
                </svg>
              </motion.div>
            </div>

            {/* Blue Smile Face (Speaking whenever TTS Audio plays) */}
            <BlueSmileMouth isSpeaking={isSpeaking} analyserRef={analyserRef} />
          </div>

          {/* Lower Torso Area (Clean, smooth white body with hands joined to sides) */}
          <div className="w-full flex-1 flex items-center justify-center" />
        </div>
      </motion.div>
    </div>
  );
}
