import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface Realistic3DDNAProps {
  className?: string;
}

export function Realistic3DDNA({ className = '' }: Realistic3DDNAProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angle = 0;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const width = 220;
    const height = 220;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const numBasePairs = 18;
    const radius = 55;
    const verticalSpread = 160;
    const centerY = height / 2;
    const centerX = width / 2;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Store particles and rungs with Z depth for painter's algorithm sorting
      const elements: Array<{
        type: 'node' | 'bar';
        z: number;
        render: () => void;
      }> = [];

      for (let i = 0; i < numBasePairs; i++) {
        const t = (i / (numBasePairs - 1)) - 0.5; // -0.5 to 0.5
        const y = centerY + t * verticalSpread;
        const currentAngle = angle + (i * 0.38);

        // Strand 1 (Adenine / Thymine cyan-blue glow)
        const x1 = centerX + Math.cos(currentAngle) * radius;
        const z1 = Math.sin(currentAngle) * radius;

        // Strand 2 (Guanine / Cytosine violet-amber glow)
        const x2 = centerX + Math.cos(currentAngle + Math.PI) * radius;
        const z2 = Math.sin(currentAngle + Math.PI) * radius;

        // Perspective scale & depth alpha
        const scale1 = (z1 + 100) / 100;
        const scale2 = (z2 + 100) / 100;
        const avgZ = (z1 + z2) / 2;

        // DNA Cross-rung base pair hydrogen bond
        elements.push({
          type: 'bar',
          z: avgZ - 2,
          render: () => {
            const grad = ctx.createLinearGradient(x1, y, x2, y);
            grad.addColorStop(0, `rgba(34, 211, 238, ${Math.max(0.2, 0.45 + (z1 / 120))})`);
            grad.addColorStop(0.5, `rgba(255, 255, 255, ${Math.max(0.3, 0.6 + (avgZ / 120))})`);
            grad.addColorStop(1, `rgba(168, 85, 247, ${Math.max(0.2, 0.45 + (z2 / 120))})`);

            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
            ctx.lineWidth = Math.max(1.5, 2.5 * ((avgZ + 70) / 140));
            ctx.strokeStyle = grad;
            ctx.stroke();

            // Hydrogen bond connector node in the middle
            const midX = (x1 + x2) / 2;
            ctx.beginPath();
            ctx.arc(midX, y, Math.max(1, 2 * ((avgZ + 70) / 140)), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.4, 0.8 + (avgZ / 120))})`;
            ctx.fill();
          }
        });

        // Strand 1 Backbone Sphere
        elements.push({
          type: 'node',
          z: z1,
          render: () => {
            const r = Math.max(2.5, 5 * scale1);
            const alpha = Math.max(0.3, (z1 + 70) / 130);

            // Glow outer halo
            ctx.save();
            ctx.shadowBlur = 12 * scale1;
            ctx.shadowColor = '#06b6d4';
            ctx.beginPath();
            ctx.arc(x1, y, r, 0, Math.PI * 2);

            const radialGrad = ctx.createRadialGradient(x1 - r * 0.3, y - r * 0.3, 1, x1, y, r);
            radialGrad.addColorStop(0, '#ffffff');
            radialGrad.addColorStop(0.3, '#38bdf8');
            radialGrad.addColorStop(1, `rgba(6, 182, 212, ${alpha})`);

            ctx.fillStyle = radialGrad;
            ctx.fill();
            ctx.restore();
          }
        });

        // Strand 2 Backbone Sphere
        elements.push({
          type: 'node',
          z: z2,
          render: () => {
            const r = Math.max(2.5, 5 * scale2);
            const alpha = Math.max(0.3, (z2 + 70) / 130);

            // Glow outer halo
            ctx.save();
            ctx.shadowBlur = 12 * scale2;
            ctx.shadowColor = '#a855f7';
            ctx.beginPath();
            ctx.arc(x2, y, r, 0, Math.PI * 2);

            const radialGrad = ctx.createRadialGradient(x2 - r * 0.3, y - r * 0.3, 1, x2, y, r);
            radialGrad.addColorStop(0, '#ffffff');
            radialGrad.addColorStop(0.3, '#c084fc');
            radialGrad.addColorStop(1, `rgba(168, 85, 247, ${alpha})`);

            ctx.fillStyle = radialGrad;
            ctx.fill();
            ctx.restore();
          }
        });
      }

      // Sort by Z (back to front) for authentic 3D depth occlusion
      elements.sort((a, b) => a.z - b.z);
      elements.forEach(el => el.render());

      angle += 0.024;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <motion.div 
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative w-[220px] h-[220px] mx-auto mb-4 flex items-center justify-center cursor-pointer select-none ${className}`}
    >
      {/* Background Volumetric Nebula Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/25 via-indigo-500/20 to-purple-500/25 blur-3xl rounded-full pointer-events-none" />
      <canvas 
        ref={canvasRef} 
        style={{ width: 220, height: 220 }}
        className="relative z-10"
      />
    </motion.div>
  );
}
