import React from 'react';
import { AIMascotThreeCanvas } from './AIMascotThreeCanvas';

interface AIMascotHeroProps {
  className?: string;
  isDarkMode?: boolean;
}

/**
 * 3D AI Teacher Mascot for ClassroomLM Hero Section
 * - Built 100% with Three.js WebGL
 * - Pure 3D procedural model (NO images)
 * - Seamless transparent canvas (NO boundary / card box around the model)
 * - Interactive cursor look-at, natural floating, eye blinking, floating atom & tablet
 */
export function AIMascotHero({ className = '', isDarkMode = false }: AIMascotHeroProps) {
  return (
    <div 
      className={`relative flex flex-col items-center justify-center select-none pointer-events-auto ${className}`}
      style={{
        background: 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
      }}
    >
      <AIMascotThreeCanvas isDarkMode={isDarkMode} />
    </div>
  );
}
