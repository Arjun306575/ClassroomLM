import React, { useEffect, useRef, useState } from 'react';

export interface LiquidWaveProps {
  isModalActive?: boolean;
  isDarkMode?: boolean;
  className?: string;
}

export type WaveMode = 'flow' | 'voice' | 'aurora';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  color: string;
  wobbleSpeed: number;
  wobbleAmp: number;
  phase: number;
  life: number;
  maxLife: number;
  isSpray?: boolean;
}

export function LiquidWave({
  isModalActive = false,
  isDarkMode = true,
  className = '',
}: LiquidWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Ambient fluid mode: 'flow' (organic Gemini), 'voice' (vocal resonance), 'aurora' (polar shimmer)
  const [mode] = useState<WaveMode>('flow');

  // Ambient and simulation refs (Touch to raise removed so scrolling down is completely smooth)
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef<number>(0);
  const modeRef = useRef<WaveMode>(mode);
  modeRef.current = mode;
  const isDarkRef = useRef<boolean>(isDarkMode);
  isDarkRef.current = isDarkMode;
  const isModalActiveRef = useRef<boolean>(isModalActive);
  isModalActiveRef.current = isModalActive;

  // Main Canvas Simulation Loop (Pure background fluid physics, zero touch interception)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationId: number;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    const resize = () => {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width || window.innerWidth;
      height = rect.height || 320;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Initialize 45 ambient floating stardust / bioluminescent droplets
    const palette = isDarkMode
      ? ['#00F0FF', '#38BDF8', '#818CF8', '#C084FC', '#F472B6', '#FBBF24']
      : ['#0284C7', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

    particlesRef.current = Array.from({ length: 45 }, () => ({
      x: Math.random() * (width || 800),
      y: (height || 300) * (0.35 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 0.35,
      vy: -(0.3 + Math.random() * 0.7),
      size: 1.2 + Math.random() * 2.2,
      alpha: 0.1 + Math.random() * 0.8,
      maxAlpha: 0.5 + Math.random() * 0.5,
      color: palette[Math.floor(Math.random() * palette.length)],
      wobbleSpeed: 0.02 + Math.random() * 0.03,
      wobbleAmp: 12 + Math.random() * 16,
      phase: Math.random() * Math.PI * 2,
      life: Math.random() * 150,
      maxLife: 150 + Math.random() * 150,
      isSpray: false,
    }));

    // Animation frame render
    const render = () => {
      timeRef.current += 1;
      const t = timeRef.current;
      const isDark = isDarkRef.current;
      const currentMode = modeRef.current;
      const isModal = isModalActiveRef.current;

      // Soft dampening if modal is open
      const modalFactor = isModal ? 0.38 : 1.0;

      // Canvas dimensions
      const logicalWidth = width;
      const logicalHeight = height;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      // Voice resonance synthesis
      let voiceEnergy = 0;
      if (currentMode === 'voice') {
        const speechEnvelope = Math.max(
          0.2,
          Math.sin(t * 0.04) * 0.4 +
          Math.sin(t * 0.09) * 0.35 +
          Math.sin(t * 0.015) * 0.25 + 0.5
        );
        voiceEnergy = speechEnvelope * modalFactor;
      }

      // ==========================================
      // Wave Layer Configurations (4-Harmonic Synthesis)
      // ==========================================
      const waveLayers = [
        // Layer 0: Deep Undertow (Cosmic / Oceanic Foundation)
        {
          baseY: logicalHeight * (0.78 - (currentMode === 'voice' ? 0.03 : 0)),
          amplitude: 22 * modalFactor,
          speed: 0.009,
          freqs: [0.0011, 0.0024, 0.0007],
          weights: [0.55, 0.3, 0.15],
          phaseOffset: 0,
          hasCrest: false,
          colors: isDark
            ? currentMode === 'aurora'
              ? ['rgba(13, 148, 136, 0.35)', 'rgba(15, 23, 42, 0.85)']
              : ['rgba(30, 27, 75, 0.55)', 'rgba(15, 23, 42, 0.9)']
            : currentMode === 'aurora'
              ? ['rgba(153, 246, 228, 0.45)', 'rgba(240, 253, 250, 0.75)']
              : ['rgba(191, 219, 254, 0.45)', 'rgba(238, 242, 255, 0.8)'],
        },
        // Layer 1: Mid Fluid Swell (Gemini Violet / Rose / Coral)
        {
          baseY: logicalHeight * 0.64,
          amplitude: 30 * modalFactor,
          speed: 0.015,
          freqs: [0.0018, 0.0036, 0.0012],
          weights: [0.5, 0.35, 0.15],
          phaseOffset: Math.PI * 0.35,
          hasCrest: true,
          crestColor: isDark
            ? currentMode === 'aurora' ? 'rgba(52, 211, 153, 0.4)' : 'rgba(244, 114, 182, 0.5)'
            : currentMode === 'aurora' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(236, 72, 153, 0.45)',
          colors: isDark
            ? currentMode === 'aurora'
              ? ['rgba(16, 185, 129, 0.45)', 'rgba(13, 148, 136, 0.25)', 'rgba(15, 23, 42, 0.8)']
              : currentMode === 'voice'
                ? ['rgba(236, 72, 153, 0.55)', 'rgba(147, 51, 234, 0.4)', 'rgba(15, 23, 42, 0.85)']
                : ['rgba(168, 85, 247, 0.45)', 'rgba(236, 72, 153, 0.35)', 'rgba(30, 27, 75, 0.8)']
            : currentMode === 'aurora'
              ? ['rgba(110, 231, 183, 0.55)', 'rgba(204, 251, 241, 0.4)', 'rgba(255, 255, 255, 0.8)']
              : currentMode === 'voice'
                ? ['rgba(244, 114, 182, 0.55)', 'rgba(192, 132, 252, 0.4)', 'rgba(245, 243, 255, 0.75)']
                : ['rgba(216, 180, 254, 0.5)', 'rgba(249, 168, 212, 0.35)', 'rgba(248, 250, 252, 0.7)'],
        },
        // Layer 2: Core Azure & Cyan Stream (Google Blue / Luminous Aqua)
        {
          baseY: logicalHeight * 0.48,
          amplitude: 36 * modalFactor,
          speed: 0.022,
          freqs: [0.0026, 0.0051, 0.0016],
          weights: [0.45, 0.4, 0.15],
          phaseOffset: Math.PI * 0.75,
          hasCrest: true,
          crestColor: isDark
            ? currentMode === 'aurora' ? 'rgba(45, 212, 191, 0.8)' : 'rgba(56, 189, 248, 0.85)'
            : currentMode === 'aurora' ? 'rgba(20, 184, 166, 0.75)' : 'rgba(2, 132, 199, 0.8)',
          colors: isDark
            ? currentMode === 'aurora'
              ? ['rgba(45, 212, 191, 0.55)', 'rgba(59, 130, 246, 0.4)', 'rgba(15, 23, 42, 0.85)']
              : currentMode === 'voice'
                ? ['rgba(6, 182, 212, 0.65)', 'rgba(59, 130, 246, 0.5)', 'rgba(15, 23, 42, 0.85)']
                : ['rgba(6, 182, 212, 0.55)', 'rgba(59, 130, 246, 0.45)', 'rgba(30, 58, 138, 0.75)']
            : currentMode === 'aurora'
              ? ['rgba(94, 234, 212, 0.65)', 'rgba(147, 197, 253, 0.45)', 'rgba(255, 255, 255, 0.8)']
              : currentMode === 'voice'
                ? ['rgba(56, 189, 248, 0.65)', 'rgba(99, 102, 241, 0.45)', 'rgba(241, 245, 249, 0.75)']
                : ['rgba(125, 211, 252, 0.6)', 'rgba(99, 102, 241, 0.4)', 'rgba(248, 250, 252, 0.75)'],
        },
        // Layer 3: High-Frequency Specular Membrane (Electric Neon Surface Crest)
        {
          baseY: logicalHeight * 0.35,
          amplitude: 26 * modalFactor,
          speed: 0.029,
          freqs: [0.0038, 0.0072, 0.0022],
          weights: [0.4, 0.4, 0.2],
          phaseOffset: Math.PI * 1.25,
          hasCrest: true,
          crestColor: isDark
            ? currentMode === 'aurora' ? '#6EE7B7' : '#00F0FF'
            : currentMode === 'aurora' ? '#059669' : '#0284C7',
          colors: isDark
            ? currentMode === 'aurora'
              ? ['rgba(52, 211, 153, 0.5)', 'rgba(45, 212, 191, 0.25)', 'transparent']
              : currentMode === 'voice'
                ? ['rgba(34, 211, 238, 0.6)', 'rgba(244, 63, 94, 0.25)', 'transparent']
                : ['rgba(34, 211, 238, 0.55)', 'rgba(129, 140, 248, 0.2)', 'transparent']
            : currentMode === 'aurora'
              ? ['rgba(110, 231, 183, 0.55)', 'rgba(147, 197, 253, 0.2)', 'transparent']
              : currentMode === 'voice'
                ? ['rgba(56, 189, 248, 0.6)', 'rgba(251, 113, 133, 0.25)', 'transparent']
                : ['rgba(56, 189, 248, 0.55)', 'rgba(167, 139, 250, 0.2)', 'transparent'],
        },
      ];

      // Draw each wave layer
      waveLayers.forEach((layer, layerIdx) => {
        ctx.beginPath();
        const startY = layer.baseY;
        ctx.moveTo(0, startY);

        const crestPoints: { x: number; y: number }[] = [];

        // Sample points across width (step = 3 for ultra-smooth fluid curve)
        const step = 3;
        for (let x = 0; x <= logicalWidth + step; x += step) {
          // Harmonic superposition
          const h1 = Math.sin(x * layer.freqs[0] + t * layer.speed + layer.phaseOffset);
          const h2 = Math.cos(x * layer.freqs[1] - t * layer.speed * 1.3 + layer.phaseOffset);
          const h3 = Math.sin(x * layer.freqs[2] + t * layer.speed * 0.7);

          let y = layer.baseY + (h1 * layer.weights[0] + h2 * layer.weights[1] + h3 * layer.weights[2]) * layer.amplitude;

          // Add AI Voice speech formant oscillation if voice mode active
          if (voiceEnergy > 0) {
            const v1 = Math.sin(x * 0.022 + t * 0.16) * 5.5 * voiceEnergy;
            const v2 = Math.cos(x * 0.048 - t * 0.24) * 3.2 * voiceEnergy;
            const v3 = Math.sin(x * 0.09 + t * 0.32) * 1.6 * voiceEnergy;
            y += (v1 + v2 + v3) * (layerIdx >= 2 ? 1.0 : 0.4);
          }

          // Gentle breathing horizon oscillation
          y += Math.sin(t * 0.007 + x * 0.0008) * 6 * modalFactor;

          ctx.lineTo(x, y);

          if (layer.hasCrest && layerIdx === 3 && x % 12 === 0) {
            crestPoints.push({ x, y });
          }
        }

        // Close fluid polygon at canvas bottom
        ctx.lineTo(logicalWidth, logicalHeight);
        ctx.lineTo(0, logicalHeight);
        ctx.closePath();

        // Fill with vertical gradient
        const gradient = ctx.createLinearGradient(0, layer.baseY - layer.amplitude, 0, logicalHeight);
        if (layer.colors.length === 2) {
          gradient.addColorStop(0, layer.colors[0]);
          gradient.addColorStop(1, layer.colors[1]);
        } else if (layer.colors.length === 3) {
          gradient.addColorStop(0, layer.colors[0]);
          gradient.addColorStop(0.35, layer.colors[1]);
          gradient.addColorStop(1, layer.colors[2]);
        }
        ctx.fillStyle = gradient;
        ctx.fill();

        // Stroke glowing specular crest line
        if (layer.hasCrest && layer.crestColor) {
          ctx.beginPath();
          for (let x = 0; x <= logicalWidth + step; x += step) {
            const h1 = Math.sin(x * layer.freqs[0] + t * layer.speed + layer.phaseOffset);
            const h2 = Math.cos(x * layer.freqs[1] - t * layer.speed * 1.3 + layer.phaseOffset);
            const h3 = Math.sin(x * layer.freqs[2] + t * layer.speed * 0.7);

            let y = layer.baseY + (h1 * layer.weights[0] + h2 * layer.weights[1] + h3 * layer.weights[2]) * layer.amplitude;

            if (voiceEnergy > 0) {
              const v1 = Math.sin(x * 0.022 + t * 0.16) * 5.5 * voiceEnergy;
              const v2 = Math.cos(x * 0.048 - t * 0.24) * 3.2 * voiceEnergy;
              const v3 = Math.sin(x * 0.09 + t * 0.32) * 1.6 * voiceEnergy;
              y += (v1 + v2 + v3) * (layerIdx >= 2 ? 1.0 : 0.4);
            }
            y += Math.sin(t * 0.007 + x * 0.0008) * 6 * modalFactor;

            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }

          ctx.lineWidth = layerIdx === 3 ? (isDark ? 2 : 1.75) : 1.25;
          ctx.strokeStyle = layer.crestColor;

          if (isDark && layerIdx === 3) {
            ctx.shadowColor = layer.crestColor;
            ctx.shadowBlur = 10;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Render AI Voice audio spectrum energy nodes along crest in voice mode
        if (currentMode === 'voice' && layerIdx === 3 && crestPoints.length > 0) {
          crestPoints.forEach((pt, pIdx) => {
            const nodePulse = Math.sin(t * 0.15 + pIdx * 0.6) * 0.5 + 0.5;
            if (nodePulse > 0.45) {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 2 + nodePulse * 2.5, 0, Math.PI * 2);
              ctx.fillStyle = isDark
                ? `rgba(0, 240, 255, ${0.4 + nodePulse * 0.5})`
                : `rgba(2, 132, 199, ${0.4 + nodePulse * 0.5})`;
              if (isDark) {
                ctx.shadowColor = '#00F0FF';
                ctx.shadowBlur = 8;
              }
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          });
        }
      });

      // ==========================================
      // Bioluminescent Stardust & Spray Droplets
      // ==========================================
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += 1;

        // Position updates
        if (p.isSpray) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.16; // gravity
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        } else {
          p.y += p.vy * modalFactor;
          p.x += Math.sin(t * p.wobbleSpeed + p.phase) * 0.45;
          const progress = p.life / p.maxLife;
          // Fade in then out
          if (progress < 0.2) p.alpha = (progress / 0.2) * p.maxAlpha;
          else if (progress > 0.7) p.alpha = ((1 - progress) / 0.3) * p.maxAlpha;
          else p.alpha = p.maxAlpha;
        }

        // Draw particle
        if (p.alpha > 0.02) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          if (isDark && p.size > 2) {
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1.0;
        }

        // Recycle ambient particles
        if (p.life >= p.maxLife || p.y < -10 || p.y > logicalHeight + 50) {
          if (p.isSpray) {
            particles.splice(i, 1);
          } else {
            p.x = Math.random() * logicalWidth;
            p.y = logicalHeight * (0.42 + Math.random() * 0.45);
            p.life = 0;
            p.maxLife = 140 + Math.random() * 160;
          }
        }
      }

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [isDarkMode]);

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-0 left-0 w-full h-[260px] sm:h-[320px] md:h-[360px] z-[5] pointer-events-none overflow-hidden select-none transition-all duration-700 ${
        isModalActive
          ? 'opacity-40 blur-[2px] saturate-[1.2] scale-y-90'
          : 'opacity-100'
      } ${className}`}
      style={{
        maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 68%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 68%, rgba(0,0,0,0) 100%)',
      }}
    >
      {/* High-Definition 60fps Liquid Physics Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{
          mixBlendMode: isDarkMode ? 'screen' : 'normal',
        }}
      />
    </div>
  );
}
