import React, { useEffect, useRef } from "react";

interface GeminiLiveWaveProps {
  isDarkMode?: boolean;
}

export function GeminiLiveWave({ isDarkMode = false }: GeminiLiveWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = canvas.offsetWidth || 800);
    let height = (canvas.height = canvas.offsetHeight || 120);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || 800;
      height = canvas.height = canvas.offsetHeight || 120;
    };

    window.addEventListener("resize", handleResize);

    // Physics parameters for organic morphing
    let time = 0;

    // Define 4 colors for the organic blending waves with lower opacities so they remain colorful
    const waves = [
      {
        color: isDarkMode ? "rgba(255, 50, 50, 0.55)" : "rgba(255, 50, 50, 0.65)", // Red
        speed: 0.015,
        freqX: 0.008,
        freqY: 0.015,
        amp: 45,
        baseY: 0.60,
        phase: 0,
      },
      {
        color: isDarkMode ? "rgba(255, 200, 0, 0.55)" : "rgba(255, 200, 0, 0.65)", // Yellow
        speed: 0.018,
        freqX: 0.007,
        freqY: 0.012,
        amp: 50,
        baseY: 0.55,
        phase: Math.PI / 4,
      },
      {
        color: isDarkMode ? "rgba(50, 255, 100, 0.55)" : "rgba(50, 255, 100, 0.65)", // Green
        speed: 0.012,
        freqX: 0.009,
        freqY: 0.018,
        amp: 40,
        baseY: 0.65,
        phase: Math.PI / 2,
      },
      {
        color: isDarkMode ? "rgba(0, 150, 255, 0.55)" : "rgba(0, 150, 255, 0.65)", // Blue
        speed: 0.020,
        freqX: 0.006,
        freqY: 0.01,
        amp: 55,
        baseY: 0.50,
        phase: Math.PI,
      },
      {
        color: isDarkMode ? "rgba(200, 50, 255, 0.55)" : "rgba(200, 50, 255, 0.65)", // Purple
        speed: 0.016,
        freqX: 0.008,
        freqY: 0.01,
        amp: 48,
        baseY: 0.58,
        phase: Math.PI * 1.5,
      },
    ];

    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Set global composite operation to produce magical liquid blending
      // Screen composite operation is spectacular in dark mode, but in light mode, source-over keeps true colors
      ctx.globalCompositeOperation = isDarkMode ? "screen" : "source-over";

      waves.forEach((wave) => {
        ctx.beginPath();
        
        // Draw fluid wave path with organic physics-based morphing
        const startY = height * wave.baseY + Math.sin(time * wave.speed + wave.phase) * (wave.amp * 0.3);
        ctx.moveTo(0, startY);

        for (let x = 0; x <= width; x += 4) {
          // Superposition of waves at different prime frequencies to mimic organic, non-rigid movement
          const wave1 = Math.sin(x * wave.freqX + time * wave.speed + wave.phase);
          const wave2 = Math.cos(x * wave.freqX * 1.7 - time * wave.speed * 1.2 + wave.phase);
          const wave3 = Math.sin(x * wave.freqX * 0.5 + time * wave.speed * 0.7 + wave.phase * 0.5);
          
          const y =
            height * wave.baseY +
            (wave1 * 0.5 + wave2 * 0.35 + wave3 * 0.15) * wave.amp +
            Math.sin(time * 0.005 + x * 0.001) * 8; // slow, hypnotic background breathing

          ctx.lineTo(x, y);
        }

        // Close path at the bottom
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        // Fill with its custom glow color
        ctx.fillStyle = wave.color;
        ctx.fill();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [isDarkMode]);

  return (
    <div className="absolute inset-x-0 bottom-0 h-[130px] pointer-events-none overflow-hidden select-none z-10">
      <canvas
        ref={canvasRef}
        className="w-full h-full filter blur-md opacity-100 transition-opacity duration-500"
        style={{ mixBlendMode: isDarkMode ? "screen" : "normal" }}
      />
    </div>
  );
}
