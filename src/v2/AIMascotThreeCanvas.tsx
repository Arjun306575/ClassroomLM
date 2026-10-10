import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface AIMascotThreeCanvasProps {
  className?: string;
  isDarkMode?: boolean;
}

// Universal cross-browser rounded rectangle helper for canvas rendering
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Creates a round, curved visor geometry that matches the exact
 * ellipsoidal front surface of the helmet with a precise microscopic forward offset.
 * Guarantees zero penetration into the head and zero empty air gaps.
 */
function createRoundVisorGeometry(
  rx: number,
  ry: number,
  offsetZ: number,
  rings = 24,
  segments = 48
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Center vertex (index 0)
  const zCenter = 1.02 * 0.66 + offsetZ;
  positions.push(0, 0, zCenter);
  uvs.push(0.5, 0.5);

  // Concentric ring vertices
  for (let r = 1; r <= rings; r++) {
    const frac = r / rings;
    const curRx = rx * frac;
    const curRy = ry * frac;

    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const x = Math.cos(angle) * curRx;
      const y = Math.sin(angle) * curRy;

      const radicand = Math.max(0, 0.66 * 0.66 - (x / 1.16) * (x / 1.16) - (y / 1.05) * (y / 1.05));
      const z = 1.02 * Math.sqrt(radicand) + offsetZ;

      positions.push(x, y, z);

      const u = 0.5 + 0.5 * Math.cos(angle) * frac;
      const v = 0.5 + 0.5 * Math.sin(angle) * frac;
      uvs.push(u, v);
    }
  }

  // Triangles for innermost circle
  for (let s = 0; s < segments; s++) {
    const nextS = (s + 1) % segments;
    indices.push(0, 1 + s, 1 + nextS);
  }

  // Triangles between concentric rings
  for (let r = 1; r < rings; r++) {
    const ringStart = 1 + (r - 1) * segments;
    const nextRingStart = 1 + r * segments;

    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;

      const p1 = ringStart + s;
      const p2 = ringStart + nextS;
      const p3 = nextRingStart + s;
      const p4 = nextRingStart + nextS;

      indices.push(p1, p3, p2);
      indices.push(p2, p3, p4);
    }
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

export function AIMascotThreeCanvas({ className = '', isDarkMode = false }: AIMascotThreeCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [, setIsInteracting] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // -------------------------------------------------------------------------
    // 1. Scene, Camera & WebGL Renderer (High Performance & Zero Lag)
    // -------------------------------------------------------------------------
    const width = container.clientWidth || 880;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.08, 6.7);
    camera.lookAt(0, 0.02, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0); // 100% Transparent background
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDarkMode ? 1.28 : 1.18;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Styling the canvas directly for pristine aesthetics
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.outline = 'none';
    renderer.domElement.style.border = 'none';
    renderer.domElement.style.background = 'transparent';
    renderer.domElement.style.touchAction = 'pan-y';
    renderer.domElement.style.cursor = 'default';
    renderer.domElement.style.filter = isDarkMode 
      ? 'drop-shadow(0 18px 40px rgba(6, 182, 212, 0.18))' 
      : 'drop-shadow(0 18px 40px rgba(37, 99, 235, 0.14))';

    // -------------------------------------------------------------------------
    // 2. High-Grade Materials with Pearlescent Sheen
    // -------------------------------------------------------------------------
    const glossyWhiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xfcfcfd,
      roughness: 0.14,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.9,
      sheen: 0.25,
      sheenRoughness: 0.25,
      sheenColor: new THREE.Color(0xa5f3fc),
    });

    const silverMetalMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0.28,
      roughness: 0.22,
    });

    const darkJointMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.28,
      metalness: 0.22,
    });

    const glossyCapMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.26,
      metalness: 0.20,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.35,
      roughness: 0.20,
    });

    const purpleTasselMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      roughness: 0.32,
      metalness: 0.2,
    });

    const cyanNeonMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    });

    const purpleNeonMat = new THREE.MeshBasicMaterial({
      color: 0xd946ef,
    });

    // -------------------------------------------------------------------------
    // 3. Fast Expressive OLED Face Screen (Drawn ONLY on State Changes - ZERO LAG!)
    // -------------------------------------------------------------------------
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = 512;
    faceCanvas.height = 512;
    const faceCtx = faceCanvas.getContext('2d', { alpha: true })!;

    type ExpressionType = 'normal' | 'blink' | 'celebrate';

    const drawFaceScreen = (expression: ExpressionType = 'normal') => {
      // Solid deep obsidian OLED background filling 100% of the canvas surface (prevents blank/dark corner gaps)
      faceCtx.fillStyle = '#060a17';
      faceCtx.fillRect(0, 0, 512, 512);

      // Curved glass reflection highlight in upper-left
      const glassGrad = faceCtx.createLinearGradient(90, 70, 260, 240);
      glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
      glassGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.03)');
      glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      faceCtx.fillStyle = glassGrad;
      faceCtx.beginPath();
      faceCtx.ellipse(195, 155, 115, 62, -Math.PI / 4, 0, Math.PI * 2);
      faceCtx.fill();

      // Glowing cyan circular border ring
      faceCtx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
      faceCtx.lineWidth = 7;
      faceCtx.beginPath();
      faceCtx.arc(256, 256, 243, 0, Math.PI * 2);
      faceCtx.stroke();

      // Soft glowing pastel blush marks (clean radial gradients)
      const drawBlush = (cx: number, cy: number) => {
        const blushGrad = faceCtx.createRadialGradient(cx, cy, 5, cx, cy, 38);
        blushGrad.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
        blushGrad.addColorStop(0.65, 'rgba(0, 240, 255, 0.12)');
        blushGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        faceCtx.fillStyle = blushGrad;
        faceCtx.beginPath();
        faceCtx.arc(cx, cy, 38, 0, Math.PI * 2);
        faceCtx.fill();
      };
      drawBlush(135, 320);
      drawBlush(377, 320);

      // Eye Centers: left (182, 240), right (330, 240)
      const lx = 182;
      const ly = 240;
      const rx = 330;
      const ry = 240;

      // Draw a cheerful open capsule eye
      const drawCapsuleEye = (cx: number, cy: number, rot: number) => {
        faceCtx.save();
        faceCtx.translate(cx, cy);
        faceCtx.rotate(rot);

        const ew = 72, eh = 106, er = 32;
        drawRoundedRect(faceCtx, -ew / 2, -eh / 2, ew, eh, er);

        // Electric aqua gradient fill
        const eyeGrad = faceCtx.createLinearGradient(0, -eh / 2, 0, eh / 2);
        eyeGrad.addColorStop(0, '#a5f3fc');
        eyeGrad.addColorStop(0.25, '#38bdf8');
        eyeGrad.addColorStop(0.75, '#06b6d4');
        eyeGrad.addColorStop(1, '#0284c7');
        faceCtx.fillStyle = eyeGrad;
        faceCtx.fill();

        // Crisp white inner outline
        faceCtx.lineWidth = 4;
        faceCtx.strokeStyle = '#ffffff';
        faceCtx.stroke();

        // Primary sparkle highlight
        faceCtx.fillStyle = '#ffffff';
        faceCtx.beginPath();
        faceCtx.arc(-12, -24, 10, 0, Math.PI * 2);
        faceCtx.fill();

        // Secondary reflection highlight
        faceCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        faceCtx.beginPath();
        faceCtx.arc(14, 21, 6, 0, Math.PI * 2);
        faceCtx.fill();

        faceCtx.restore();
      };

      // Draw happy arch eye (^ shape)
      const drawHappyArch = (cx: number, cy: number) => {
        faceCtx.save();
        faceCtx.strokeStyle = '#00f5ff';
        faceCtx.lineWidth = 18;
        faceCtx.lineCap = 'round';
        faceCtx.lineJoin = 'round';

        faceCtx.beginPath();
        faceCtx.moveTo(cx - 45, cy + 15);
        faceCtx.quadraticCurveTo(cx, cy - 40, cx + 45, cy + 15);
        faceCtx.stroke();
        faceCtx.restore();
      };

      // RENDER EYES BASED ON EXPRESSION
      if (expression === 'blink') {
        drawHappyArch(lx, ly);
        drawHappyArch(rx, ry);
      } else if (expression === 'celebrate') {
        drawHappyArch(lx, ly);
        drawHappyArch(rx, ry);
      } else {
        // Normal state: Clean cheerful capsule eyes
        drawCapsuleEye(lx, ly, -0.06);
        drawCapsuleEye(rx, ry, 0.06);
      }

      // Cute Glowing Smile (‿)
      faceCtx.strokeStyle = '#00f5ff';
      faceCtx.lineWidth = 13;
      faceCtx.lineCap = 'round';

      faceCtx.beginPath();
      faceCtx.moveTo(218, 315);
      faceCtx.quadraticCurveTo(256, 356, 294, 315);
      faceCtx.stroke();
    };

    // Draw initial static face once (no per-frame redraws!)
    drawFaceScreen('normal');
    const faceTexture = new THREE.CanvasTexture(faceCanvas);
    faceTexture.colorSpace = THREE.SRGBColorSpace;
    faceTexture.needsUpdate = true;

    // OLED Visor Screen Material
    const visorScreenMat = new THREE.MeshStandardMaterial({
      map: faceTexture,
      emissiveMap: faceTexture,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.85,
      roughness: 0.16,
      metalness: 0.05,
    });

    // -------------------------------------------------------------------------
    // 4. Procedural Textures for 4 Educational Satellites
    // -------------------------------------------------------------------------
    const createTileTexture = (
      type: 'book' | 'code' | 'flask' | 'globe',
      topColor: string,
      bottomColor: string
    ): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Deep, highly saturated background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
      bgGrad.addColorStop(0, topColor);
      bgGrad.addColorStop(1, bottomColor);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 512);

      // Subtle soft ambient vignette
      const radGrad = ctx.createRadialGradient(256, 256, 100, 256, 256, 340);
      radGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
      radGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
      radGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, 512, 512);

      // Crisp high-contrast border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 11;
      drawRoundedRect(ctx, 21, 21, 470, 470, 55);
      ctx.stroke();

      // Bold pure white vector icon
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (type === 'book') {
        const yTop = 160;
        const yBottom = 360;
        ctx.beginPath();
        ctx.moveTo(256, yTop + 35);
        ctx.bezierCurveTo(195, yTop, 130, yTop, 75, yTop + 25);
        ctx.lineTo(75, yBottom + 25);
        ctx.bezierCurveTo(130, yBottom, 195, yBottom, 256, yBottom + 35);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(256, yTop + 35);
        ctx.bezierCurveTo(317, yTop, 382, yTop, 437, yTop + 25);
        ctx.lineTo(437, yBottom + 25);
        ctx.bezierCurveTo(382, yBottom, 317, yBottom, 256, yBottom + 35);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(256, yTop + 35);
        ctx.lineTo(256, yBottom + 35);
        ctx.stroke();

        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(256, yBottom + 35);
        ctx.lineTo(235, yBottom + 80);
        ctx.lineTo(256, yBottom + 65);
        ctx.lineTo(277, yBottom + 80);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      } else if (type === 'code') {
        ctx.lineWidth = 29;
        ctx.beginPath();
        ctx.moveTo(170, 175);
        ctx.lineTo(95, 256);
        ctx.lineTo(170, 337);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(290, 140);
        ctx.lineTo(222, 372);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(342, 175);
        ctx.lineTo(417, 256);
        ctx.lineTo(342, 337);
        ctx.stroke();
      } else if (type === 'flask') {
        ctx.lineWidth = 23;
        ctx.beginPath();
        ctx.moveTo(205, 130);
        ctx.lineTo(307, 130);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(224, 130);
        ctx.lineTo(224, 215);
        ctx.lineTo(125, 365);
        ctx.quadraticCurveTo(115, 385, 140, 385);
        ctx.lineTo(372, 385);
        ctx.quadraticCurveTo(397, 385, 387, 365);
        ctx.lineTo(288, 215);
        ctx.lineTo(288, 130);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(172, 310);
        ctx.quadraticCurveTo(256, 292, 340, 310);
        ctx.lineTo(372, 375);
        ctx.lineTo(140, 375);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(225, 342, 14, 0, Math.PI * 2);
        ctx.arc(288, 332, 18, 0, Math.PI * 2);
        ctx.arc(260, 260, 11, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'globe') {
        ctx.lineWidth = 23;
        ctx.beginPath();
        ctx.arc(256, 256, 130, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(256, 256, 130, 42, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(256, 256, 57, 130, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(256, 126);
        ctx.lineTo(256, 386);
        ctx.stroke();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    // Generator for Smart Tablet Screen
    const createTabletTexture = (): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 680;
      const ctx = canvas.getContext('2d')!;

      const grad = ctx.createLinearGradient(0, 0, 512, 680);
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(0.35, '#2563eb');
      grad.addColorStop(0.7, '#7c3aed');
      grad.addColorStop(1, '#9333ea');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 680);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 12;
      drawRoundedRect(ctx, 20, 20, 472, 640, 40);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('ClassroomLM · Interactive AI', 40, 70);

      // Clean White Embossed Graduation Cap in center
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';

      // Cap Diamond
      ctx.beginPath();
      ctx.moveTo(256, 230);
      ctx.lineTo(405, 300);
      ctx.lineTo(256, 370);
      ctx.lineTo(107, 300);
      ctx.closePath();
      ctx.fill();

      // Cap Skull
      ctx.beginPath();
      ctx.moveTo(170, 345);
      ctx.quadraticCurveTo(256, 435, 342, 345);
      ctx.lineTo(342, 385);
      ctx.quadraticCurveTo(256, 475, 170, 385);
      ctx.closePath();
      ctx.fill();

      // Cap Tassel
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(256, 300);
      ctx.lineTo(405, 365);
      ctx.lineTo(405, 430);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(405, 442, 18, 0, Math.PI * 2);
      ctx.fill();

      // Lower progress bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      drawRoundedRect(ctx, 60, 570, 392, 16, 8);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      drawRoundedRect(ctx, 60, 570, 310, 16, 8);
      ctx.fill();

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    // Holographic Lesson Board Texture with Formulas & Atom
    const createLessonBoardTexture = (): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 384;
      const ctx = canvas.getContext('2d')!;

      ctx.clearRect(0, 0, 512, 384);

      ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
      ctx.fillRect(0, 0, 512, 384);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 9;
      ctx.strokeRect(8, 8, 496, 368);

      // Corner technical brackets
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      const bLen = 20;
      ctx.beginPath();
      ctx.moveTo(16, 16 + bLen); ctx.lineTo(16, 16); ctx.lineTo(16 + bLen, 16);
      ctx.moveTo(496 - bLen, 16); ctx.lineTo(496, 16); ctx.lineTo(496, 16 + bLen);
      ctx.moveTo(16, 368 - bLen); ctx.lineTo(16, 368); ctx.lineTo(16 + bLen, 368);
      ctx.moveTo(496 - bLen, 368); ctx.lineTo(496, 368); ctx.lineTo(496, 368 - bLen);
      ctx.stroke();

      // Right-angled triangle on left with labeled formula
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(60, 304);
      ctx.lineTo(232, 304);
      ctx.lineTo(60, 136);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      ctx.strokeRect(60, 274, 30, 30);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('a² + b² = c²', 95, 330);
      ctx.fillText('E = mc²', 270, 130);
      ctx.fillText('e^(iπ) + 1 = 0', 270, 165);

      // 3D Atom diagram on bottom right
      const ax = 356, ay = 272;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5;
      for (let rot = 0; rot < Math.PI; rot += Math.PI / 3) {
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, 58, 21, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ax, ay, 13, 0, Math.PI * 2);
      ctx.fill();

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    // -------------------------------------------------------------------------
    // 5. Mascot Construction
    // -------------------------------------------------------------------------
    const mascotRoot = new THREE.Group();
    scene.add(mascotRoot);

    // =========================================================================
    // LAYER 1: HEAD & ROUND OLED VISOR SCREEN
    // =========================================================================
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.86, 0);
    mascotRoot.add(headGroup);

    // 1. Ceramic White Helmet Shell
    const helmetGeom = new THREE.SphereGeometry(0.66, 48, 36);
    const helmetMesh = new THREE.Mesh(helmetGeom, glossyWhiteMat);
    helmetMesh.scale.set(1.16, 1.05, 1.02);
    helmetMesh.castShadow = true;
    headGroup.add(helmetMesh);

    // 2. ROUND OLED VISOR SCREEN (Clean forward offset prevents Z-fighting and black gaps)
    const roundVisorGeom = createRoundVisorGeometry(0.44, 0.40, 0.024, 24, 48);
    const roundVisorMesh = new THREE.Mesh(roundVisorGeom, visorScreenMat);
    roundVisorMesh.renderOrder = 10;
    headGroup.add(roundVisorMesh);

    // 3. Curved Glass Faceplate (Smooth clearcoat without transmission holes or z-fighting)
    const glassCoverGeom = createRoundVisorGeometry(0.442, 0.402, 0.030, 20, 36);
    const glassCoverMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      opacity: 0.16,
      transparent: true,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.8,
      depthWrite: false,
    });
    const glassCoverMesh = new THREE.Mesh(glassCoverGeom, glassCoverMat);
    glassCoverMesh.renderOrder = 12;
    headGroup.add(glassCoverMesh);

    // 4. Headphone Ear Cups on Helmet Sides (Solid 3D platinum metallic finish, zero dark holes)
    const headphoneRings: THREE.Mesh[] = [];
    [-1, 1].forEach((side) => {
      const earGroup = new THREE.Group();
      earGroup.position.set(side * 0.77, 0.02, 0);
      earGroup.rotation.z = side * -0.08;

      const earCylinderGeom = new THREE.CylinderGeometry(0.24, 0.26, 0.16, 24);
      const earMesh = new THREE.Mesh(earCylinderGeom, silverMetalMat);
      earMesh.rotation.z = Math.PI / 2;
      earGroup.add(earMesh);

      const earRingGeom = new THREE.TorusGeometry(0.2, 0.025, 12, 24);
      const earRingMesh = new THREE.Mesh(earRingGeom, cyanNeonMat);
      earRingMesh.rotation.y = Math.PI / 2;
      earGroup.add(earRingMesh);
      headphoneRings.push(earRingMesh);

      const innerCoreGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.02, 24);
      const innerCoreMesh = new THREE.Mesh(innerCoreGeom, purpleNeonMat);
      innerCoreMesh.position.x = side * 0.09;
      innerCoreMesh.rotation.z = Math.PI / 2;
      earGroup.add(innerCoreMesh);

      headGroup.add(earGroup);
    });

    // 6. Graduation Mortarboard Cap
    const capGroup = new THREE.Group();
    capGroup.position.set(0, 0.64, 0.04);
    capGroup.rotation.x = -0.12;
    capGroup.rotation.z = -0.04;
    headGroup.add(capGroup);

    const capBaseGeom = new THREE.CylinderGeometry(0.5, 0.58, 0.2, 24);
    const capBaseMesh = new THREE.Mesh(capBaseGeom, glossyCapMat);
    capGroup.add(capBaseMesh);

    const mortarboardGeom = new THREE.BoxGeometry(1.45, 0.05, 1.45);
    const mortarboardMesh = new THREE.Mesh(mortarboardGeom, glossyCapMat);
    mortarboardMesh.position.y = 0.12;
    mortarboardMesh.rotation.y = Math.PI / 4;
    mortarboardMesh.castShadow = true;
    capGroup.add(mortarboardMesh);

    const capGoldBezelGeom = new THREE.BoxGeometry(1.47, 0.02, 1.47);
    const capGoldBezelMesh = new THREE.Mesh(capGoldBezelGeom, goldMat);
    capGoldBezelMesh.position.y = 0.12;
    capGoldBezelMesh.rotation.y = Math.PI / 4;
    capGroup.add(capGoldBezelMesh);

    const buttonGeom = new THREE.CylinderGeometry(0.08, 0.09, 0.06, 16);
    const buttonMesh = new THREE.Mesh(buttonGeom, goldMat);
    buttonMesh.position.y = 0.17;
    capGroup.add(buttonMesh);

    // Hanging Purple Silk Tassel
    const tasselGroup = new THREE.Group();
    tasselGroup.position.set(-0.50, 0.12, 0.50);
    capGroup.add(tasselGroup);

    const tasselCordGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.44, 8);
    const tasselCordMesh = new THREE.Mesh(tasselCordGeom, purpleTasselMat);
    tasselCordMesh.position.set(0, -0.22, 0);
    tasselGroup.add(tasselCordMesh);

    const tasselBrushGeom = new THREE.ConeGeometry(0.065, 0.18, 14);
    const tasselBrushMesh = new THREE.Mesh(tasselBrushGeom, purpleTasselMat);
    tasselBrushMesh.position.set(0, -0.48, 0);
    tasselBrushMesh.rotation.x = Math.PI;
    tasselGroup.add(tasselBrushMesh);

    // =========================================================================
    // LAYER 2: BODY, DISTINCT SILVER NECK & SLEEK CHEST CORE
    // =========================================================================
    const bodyGroup = new THREE.Group();
    mascotRoot.add(bodyGroup);

    const neckGeom = new THREE.CylinderGeometry(0.24, 0.28, 0.14, 24);
    const neckMesh = new THREE.Mesh(neckGeom, silverMetalMat);
    neckMesh.position.y = 0.36;
    bodyGroup.add(neckMesh);

    const torsoGeom = new THREE.CapsuleGeometry(0.58, 0.66, 24, 24);
    const torsoMesh = new THREE.Mesh(torsoGeom, glossyWhiteMat);
    torsoMesh.position.y = -0.16;
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = false;
    bodyGroup.add(torsoMesh);

    // Chest Reactor
    const chestCoreGroup = new THREE.Group();
    chestCoreGroup.position.set(0, 0.08, 0.58);
    chestCoreGroup.rotation.x = -0.12;
    bodyGroup.add(chestCoreGroup);

    const chestPlateGeom = new THREE.CylinderGeometry(0.26, 0.28, 0.04, 24);
    const chestPlateMesh = new THREE.Mesh(chestPlateGeom, glossyWhiteMat);
    chestPlateMesh.rotation.x = Math.PI / 2;
    chestCoreGroup.add(chestPlateMesh);

    const coreRimGeom = new THREE.TorusGeometry(0.22, 0.024, 12, 28);
    const coreRimMesh = new THREE.Mesh(coreRimGeom, silverMetalMat);
    coreRimMesh.position.z = 0.025;
    chestCoreGroup.add(coreRimMesh);

    const cyanRingGeom = new THREE.TorusGeometry(0.16, 0.02, 12, 24);
    const cyanRingMesh = new THREE.Mesh(cyanRingGeom, cyanNeonMat);
    cyanRingMesh.position.z = 0.035;
    chestCoreGroup.add(cyanRingMesh);

    const purpleRingGeom = new THREE.TorusGeometry(0.10, 0.016, 12, 24);
    const purpleRingMesh = new THREE.Mesh(purpleRingGeom, purpleNeonMat);
    purpleRingMesh.position.z = 0.045;
    chestCoreGroup.add(purpleRingMesh);

    const centerSparkGeom = new THREE.SphereGeometry(0.065, 14, 14);
    const centerSparkMesh = new THREE.Mesh(centerSparkGeom, cyanNeonMat);
    centerSparkMesh.position.z = 0.055;
    chestCoreGroup.add(centerSparkMesh);

    const chestPointLight = new THREE.PointLight(0x00f0ff, 1.2, 2.2);
    chestPointLight.position.set(0, 0.08, 0.65);
    bodyGroup.add(chestPointLight);

    const pelvisGeom = new THREE.SphereGeometry(0.48, 24, 18);
    const pelvisMesh = new THREE.Mesh(pelvisGeom, glossyWhiteMat);
    pelvisMesh.scale.set(1.02, 0.7, 0.95);
    pelvisMesh.position.y = -0.78;
    pelvisMesh.castShadow = true;
    bodyGroup.add(pelvisMesh);

    const thrusterRimGeom = new THREE.TorusGeometry(0.38, 0.035, 12, 28);
    const thrusterRimMesh = new THREE.Mesh(thrusterRimGeom, cyanNeonMat);
    thrusterRimMesh.position.y = -0.92;
    thrusterRimMesh.rotation.x = Math.PI / 2;
    bodyGroup.add(thrusterRimMesh);

    // Plasma thruster plume
    const thrusterPlumeGeom = new THREE.CylinderGeometry(0.24, 0.04, 0.54, 20, 1, true);
    const thrusterPlumeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const thrusterPlumeMesh = new THREE.Mesh(thrusterPlumeGeom, thrusterPlumeMat);
    thrusterPlumeMesh.position.y = -1.22;
    bodyGroup.add(thrusterPlumeMesh);

    const thrusterInnerGeom = new THREE.CylinderGeometry(0.12, 0.02, 0.36, 14, 1, true);
    const thrusterInnerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const thrusterInnerMesh = new THREE.Mesh(thrusterInnerGeom, thrusterInnerMat);
    thrusterInnerMesh.position.y = -1.12;
    bodyGroup.add(thrusterInnerMesh);

    // =========================================================================
    // LAYER 3: CONTINUOUS ARMS & SMART TABLET WITH HOLOGRAPHIC 3D ATOM
    // =========================================================================
    // LEFT ARM (holding tablet)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.54, 0.06, 0);
    bodyGroup.add(leftArmGroup);

    const shoulderLGeom = new THREE.SphereGeometry(0.16, 18, 18);
    const shoulderLMesh = new THREE.Mesh(shoulderLGeom, glossyWhiteMat);
    leftArmGroup.add(shoulderLMesh);

    const bicepLGeom = new THREE.CapsuleGeometry(0.09, 0.28, 14, 14);
    const bicepLMesh = new THREE.Mesh(bicepLGeom, glossyWhiteMat);
    bicepLMesh.position.set(-0.10, -0.16, 0.16);
    bicepLMesh.rotation.set(0.68, -0.15, 0.18);
    leftArmGroup.add(bicepLMesh);

    const elbowLGeom = new THREE.SphereGeometry(0.095, 14, 14);
    const elbowLMesh = new THREE.Mesh(elbowLGeom, silverMetalMat);
    elbowLMesh.position.set(-0.16, -0.32, 0.32);
    leftArmGroup.add(elbowLMesh);

    const forearmLGeom = new THREE.CapsuleGeometry(0.085, 0.34, 14, 14);
    const forearmLMesh = new THREE.Mesh(forearmLGeom, glossyWhiteMat);
    forearmLMesh.position.set(-0.06, -0.32, 0.58);
    forearmLMesh.rotation.set(0.85, -0.22, -0.16);
    leftArmGroup.add(forearmLMesh);

    const handLGroup = new THREE.Group();
    handLGroup.position.set(-0.02, -0.30, 0.78);
    leftArmGroup.add(handLGroup);

    const handLGeom = new THREE.SphereGeometry(0.09, 14, 14);
    const handLMesh = new THREE.Mesh(handLGeom, glossyWhiteMat);
    handLGroup.add(handLMesh);

    [-0.04, 0, 0.04].forEach((offsetY) => {
      const fingerGeom = new THREE.CapsuleGeometry(0.025, 0.09, 10, 10);
      const fingerMesh = new THREE.Mesh(fingerGeom, glossyWhiteMat);
      fingerMesh.position.set(0.07, offsetY, 0.04);
      fingerMesh.rotation.set(0.3, 0.5, 0.4);
      handLGroup.add(fingerMesh);
    });

    // SMART TABLET
    const tabletGroup = new THREE.Group();
    tabletGroup.position.set(-0.52, -0.18, 0.88);
    tabletGroup.rotation.set(-0.28, 0.36, -0.12);
    mascotRoot.add(tabletGroup);

    const tabletTexture = createTabletTexture();
    const tabletScreenMat = new THREE.MeshStandardMaterial({
      map: tabletTexture,
      roughness: 0.18,
      metalness: 0.1,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 0.38,
    });

    const tabletMaterials = [
      silverMetalMat,  // +X
      silverMetalMat,  // -X
      silverMetalMat,  // +Y
      silverMetalMat,  // -Y
      tabletScreenMat, // +Z (FRONT SCREEN)
      silverMetalMat,  // -Z
    ];

    const tabletGeom = new THREE.BoxGeometry(0.72, 0.98, 0.04);
    const tabletMesh = new THREE.Mesh(tabletGeom, tabletMaterials);
    tabletMesh.castShadow = true;
    tabletGroup.add(tabletMesh);

    // MINI 3D HOLOGRAPHIC ATOM ABOVE TABLET
    const miniAtomGroup = new THREE.Group();
    miniAtomGroup.position.set(0, 0.05, 0.16);
    tabletGroup.add(miniAtomGroup);

    const miniNucleus = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 14, 14),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: new THREE.Color(0xf59e0b),
        emissiveIntensity: 0.85,
      })
    );
    miniAtomGroup.add(miniNucleus);

    const miniRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
    const miniRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.006, 6, 20), miniRingMat);
    const miniRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.006, 6, 20), miniRingMat);
    miniRing2.rotation.x = Math.PI / 2.3;
    miniRing2.rotation.y = Math.PI / 4;
    miniAtomGroup.add(miniRing1);
    miniAtomGroup.add(miniRing2);

    // RIGHT ARM (holding pointer stylus)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.54, 0.06, 0);
    bodyGroup.add(rightArmGroup);

    const shoulderRMesh = new THREE.Mesh(shoulderLGeom, glossyWhiteMat);
    rightArmGroup.add(shoulderRMesh);

    const bicepRGeom = new THREE.CapsuleGeometry(0.09, 0.28, 14, 14);
    const bicepRMesh = new THREE.Mesh(bicepRGeom, glossyWhiteMat);
    bicepRMesh.position.set(0.12, 0.12, 0.08);
    bicepRMesh.rotation.set(-0.55, 0.12, -0.62);
    rightArmGroup.add(bicepRMesh);

    const elbowRGeom = new THREE.SphereGeometry(0.095, 14, 14);
    const elbowRMesh = new THREE.Mesh(elbowRGeom, silverMetalMat);
    elbowRMesh.position.set(0.25, 0.26, 0.18);
    rightArmGroup.add(elbowRMesh);

    const forearmRGeom = new THREE.CapsuleGeometry(0.085, 0.36, 14, 14);
    const forearmRMesh = new THREE.Mesh(forearmRGeom, glossyWhiteMat);
    forearmRMesh.position.set(0.42, 0.44, 0.28);
    forearmRMesh.rotation.set(-0.52, 0.16, -0.74);
    rightArmGroup.add(forearmRMesh);

    const handRGeom = new THREE.SphereGeometry(0.09, 14, 14);
    const handRMesh = new THREE.Mesh(handRGeom, glossyWhiteMat);
    handRMesh.position.set(0.56, 0.60, 0.36);
    rightArmGroup.add(handRMesh);

    // Teaching Pointer Stylus
    const pointerGeom = new THREE.CylinderGeometry(0.016, 0.024, 0.54, 14);
    const pointerMesh = new THREE.Mesh(pointerGeom, silverMetalMat);
    pointerMesh.position.set(0.72, 0.78, 0.46);
    pointerMesh.rotation.set(-0.5, 0.18, -0.74);
    rightArmGroup.add(pointerMesh);

    const stylusGripGeom = new THREE.CylinderGeometry(0.026, 0.026, 0.12, 14);
    const stylusGripMesh = new THREE.Mesh(stylusGripGeom, goldMat);
    stylusGripMesh.position.set(0.66, 0.71, 0.42);
    stylusGripMesh.rotation.set(-0.5, 0.18, -0.74);
    rightArmGroup.add(stylusGripMesh);

    const pointerTipGeom = new THREE.SphereGeometry(0.044, 14, 14);
    const pointerTipMesh = new THREE.Mesh(pointerTipGeom, cyanNeonMat);
    pointerTipMesh.position.set(0.88, 0.96, 0.56);
    rightArmGroup.add(pointerTipMesh);

    const pointerLight = new THREE.PointLight(0x00f0ff, 1.4, 2.0);
    pointerLight.position.set(0.88, 0.96, 0.56);
    rightArmGroup.add(pointerLight);

    // =========================================================================
    // LAYER 4: FLOATING HOLOGRAPHIC LESSON BOARD
    // =========================================================================
    const lessonBoardGroup = new THREE.Group();
    lessonBoardGroup.position.set(1.60, 0.62, 0.22);
    lessonBoardGroup.rotation.y = -0.32;
    lessonBoardGroup.rotation.x = 0.06;
    mascotRoot.add(lessonBoardGroup);

    const lessonBoardTexture = createLessonBoardTexture();
    const boardMat = new THREE.MeshStandardMaterial({
      map: lessonBoardTexture,
      transparent: true,
      opacity: 0.92,
      roughness: 0.15,
      metalness: 0.1,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.25,
    });

    const boardGeom = new THREE.PlaneGeometry(1.48, 1.08);
    const boardMesh = new THREE.Mesh(boardGeom, boardMat);
    lessonBoardGroup.add(boardMesh);

    const scanLineGeom = new THREE.PlaneGeometry(1.44, 0.015);
    const scanLineMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const scanLineMesh = new THREE.Mesh(scanLineGeom, scanLineMat);
    scanLineMesh.position.z = 0.01;
    lessonBoardGroup.add(scanLineMesh);

    // =========================================================================
    // LAYER 5: DUAL GYROSCOPE ORBIT RINGS & GROUND HALO (NO FLOATING DOTS/BEADS)
    // =========================================================================
    const gyroGroup = new THREE.Group();
    mascotRoot.add(gyroGroup);

    // Ring 1 (Cyan)
    const gyroRing1Geom = new THREE.TorusGeometry(2.35, 0.024, 12, 64);
    const gyroRing1Mat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.5,
    });
    const gyroRing1 = new THREE.Mesh(gyroRing1Geom, gyroRing1Mat);
    gyroRing1.rotation.x = Math.PI / 3.1;
    gyroRing1.rotation.y = 0.2;
    gyroGroup.add(gyroRing1);

    // Ring 2 (Purple)
    const gyroRing2Geom = new THREE.TorusGeometry(2.55, 0.020, 12, 64);
    const gyroRing2Mat = new THREE.MeshBasicMaterial({
      color: 0xd946ef,
      transparent: true,
      opacity: 0.45,
    });
    const gyroRing2 = new THREE.Mesh(gyroRing2Geom, gyroRing2Mat);
    gyroRing2.rotation.x = -Math.PI / 3.8;
    gyroRing2.rotation.y = -0.3;
    gyroGroup.add(gyroRing2);

    // Ground Neon Halo
    const groundHaloGeom = new THREE.TorusGeometry(0.74, 0.028, 12, 48);
    const groundHaloMesh = new THREE.Mesh(groundHaloGeom, new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    }));
    groundHaloMesh.position.y = -1.62;
    groundHaloMesh.rotation.x = Math.PI / 2;
    scene.add(groundHaloMesh);

    // =========================================================================
    // LAYER 6: 4 EDUCATIONAL FEATURE SATELLITES (NO FLOATING DOTS)
    // =========================================================================
    const tilesGroup = new THREE.Group();
    mascotRoot.add(tilesGroup);

    const createFloatingTile = (
      type: 'book' | 'code' | 'flask' | 'globe',
      topColor: string,
      bottomColor: string,
      pos: [number, number, number],
      rot: [number, number, number]
    ) => {
      const group = new THREE.Group();
      group.position.set(pos[0], pos[1], pos[2]);
      group.rotation.set(rot[0], rot[1], rot[2]);

      const tileTexture = createTileTexture(type, topColor, bottomColor);

      const iconFrontMat = new THREE.MeshStandardMaterial({
        map: tileTexture,
        roughness: 0.22,
        metalness: 0.08,
        emissive: new THREE.Color(topColor),
        emissiveIntensity: 0.38,
      });

      const tileBezelMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(bottomColor),
        roughness: 0.28,
        metalness: 0.15,
        emissive: new THREE.Color(bottomColor),
        emissiveIntensity: 0.2,
      });

      const materials = [
        tileBezelMat, // +X
        tileBezelMat, // -X
        tileBezelMat, // +Y
        tileBezelMat, // -Y
        iconFrontMat, // +Z (FRONT FACE)
        tileBezelMat, // -Z
      ];

      const tileGeom = new THREE.BoxGeometry(0.66, 0.66, 0.10);
      const tileMesh = new THREE.Mesh(tileGeom, materials);
      tileMesh.castShadow = true;
      group.add(tileMesh);

      tilesGroup.add(group);
      return group;
    };

    const bookTile = createFloatingTile('book', '#9333ea', '#581c87', [-1.85, 0.65, 0.15], [0.12, 0.32, -0.08]);
    const codeTile = createFloatingTile('code', '#2563eb', '#1e3a8a', [-1.75, -0.48, 0.45], [-0.12, 0.28, 0.08]);
    const flaskTile = createFloatingTile('flask', '#ec4899', '#9d174d', [1.85, -0.15, 0.25], [0.10, -0.30, 0.06]);
    const globeTile = createFloatingTile('globe', '#06b6d4', '#0e7490', [1.55, -0.80, 0.45], [-0.18, -0.26, -0.05]);

    // -------------------------------------------------------------------------
    // 6. Studio Lighting Setup (Rich Studio Glow with Zero Shadow Acne)
    // -------------------------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(
      isDarkMode ? 0xa5b4fc : 0xffffff,
      isDarkMode ? 0.95 : 1.15
    );
    scene.add(ambientLight);

    // Flattering 360-degree studio bounce light ensures no crevice or joint is ever pitch-black
    const hemiLight = new THREE.HemisphereLight(
      isDarkMode ? 0xc7d2fe : 0xffffff,
      isDarkMode ? 0x1e1b4b : 0x94a3b8,
      isDarkMode ? 0.75 : 0.85
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, isDarkMode ? 2.5 : 2.2);
    keyLight.position.set(3.5, 4.5, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.03;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x818cf8, isDarkMode ? 1.4 : 1.1);
    fillLight.position.set(-3.5, 2.5, 2.5);
    scene.add(fillLight);

    const cyanRimLight = new THREE.PointLight(0x06b6d4, isDarkMode ? 3.8 : 2.8, 12);
    cyanRimLight.position.set(0, -0.6, -2);
    scene.add(cyanRimLight);

    const purpleRimLight = new THREE.PointLight(0xa855f7, isDarkMode ? 2.8 : 1.9, 10);
    purpleRimLight.position.set(2, -0.4, 1.2);
    scene.add(purpleRimLight);

    // Soft Shadow-Only Floor
    const shadowPlaneGeom = new THREE.PlaneGeometry(6, 6);
    const shadowPlaneMat = new THREE.ShadowMaterial({
      opacity: isDarkMode ? 0.38 : 0.16,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeom, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.65;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // CRITICAL: Explicitly prevent self-shadowing and shadow acne on the 3D mascot body and satellites
    // This completely guarantees zero black scratches, zero dark zebra streaks, and zero holes on the 3D mascot.
    mascotRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.receiveShadow = false;
      }
    });
    tilesGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.receiveShadow = false;
      }
    });

    // -------------------------------------------------------------------------
    // 7. Interactive Expressions & Animation Loop (Rotate Feature Removed for Smooth Scrolling)
    // -------------------------------------------------------------------------
    let blinkTimer = 0;
    let currentExpression: ExpressionType = 'normal';
    let celebrationTimer = 0;
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const handleClick = () => {
      setIsInteracting(true);
      celebrationTimer = 1.0;
      currentExpression = 'celebrate';
      drawFaceScreen('celebrate');
      faceTexture.needsUpdate = true;

      setTimeout(() => {
        if (celebrationTimer <= 0) {
          currentExpression = 'normal';
          drawFaceScreen('normal');
          faceTexture.needsUpdate = true;
          setIsInteracting(false);
        }
      }, 900);
    };

    container.addEventListener('click', handleClick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 880;
      const h = container.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // -------------------------------------------------------------------------
    // 8. Animation Loop (ZERO CANVAS REDRAWS PER FRAME = ZERO LAG!)
    // -------------------------------------------------------------------------
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Levitation floating motion with celebration bounce
      let floatOffset = Math.sin(elapsedTime * 1.6) * 0.1;
      if (celebrationTimer > 0) {
        celebrationTimer -= 0.016;
        floatOffset += Math.sin(celebrationTimer * Math.PI) * 0.16;
      }
      mascotRoot.position.y = floatOffset;

      // Fixed upright orientation (no drag rotation, ensuring smooth vertical scrolling)
      mascotRoot.rotation.set(0, 0, 0);
      headGroup.rotation.set(0, 0, 0);

      // Tassel Swing Physics
      tasselGroup.rotation.z = Math.sin(elapsedTime * 2.2) * 0.14;
      tasselGroup.rotation.x = Math.cos(elapsedTime * 1.8) * 0.1;

      // Interactive Arm Waving on click celebration
      if (celebrationTimer > 0) {
        const waveAngle = Math.sin(elapsedTime * 12) * 0.22;
        rightArmGroup.rotation.z = -0.4 + waveAngle;
        rightArmGroup.rotation.x = -0.2 + waveAngle * 0.5;
      } else {
        rightArmGroup.rotation.z = 0;
        rightArmGroup.rotation.x = 0;
      }

      // Discrete Eye Blinking Logic (ONLY triggers texture update on state change!)
      blinkTimer += 0.016;
      if (celebrationTimer <= 0) {
        if (currentExpression === 'normal' && blinkTimer > 3.6 + Math.sin(elapsedTime) * 1.4) {
          currentExpression = 'blink';
          blinkTimer = 0;
          drawFaceScreen('blink');
          faceTexture.needsUpdate = true;
        } else if (currentExpression === 'blink' && blinkTimer > 0.15) {
          currentExpression = 'normal';
          blinkTimer = 0;
          drawFaceScreen('normal');
          faceTexture.needsUpdate = true;
        }
      }

      // Gyroscope Orbit Rings Rotation (smooth continuous without dots)
      gyroRing1.rotation.z = elapsedTime * 0.18;
      gyroRing2.rotation.z = -elapsedTime * 0.14;

      // Mini 3D Holographic Atom above Tablet
      miniAtomGroup.rotation.y += 0.035;
      miniAtomGroup.rotation.x += 0.02;

      // Holographic Lesson Board hover & scanline sweep
      lessonBoardGroup.position.y = 0.62 + Math.sin(elapsedTime * 1.8 + 1) * 0.05;
      scanLineMesh.position.y = Math.sin(elapsedTime * 1.5) * 0.48;

      // Plasma Thruster Ion Plume Pulse
      const thrusterPulse = 1 + Math.sin(elapsedTime * 8) * 0.15;
      thrusterPlumeMesh.scale.set(thrusterPulse, 1 + Math.sin(elapsedTime * 10) * 0.2, thrusterPulse);
      thrusterInnerMesh.scale.set(thrusterPulse, 1 + Math.sin(elapsedTime * 12) * 0.18, thrusterPulse);

      // Headphone Neon Rings Rotation
      headphoneRings.forEach((ring, idx) => {
        ring.rotation.z = elapsedTime * (idx === 0 ? 0.8 : -0.8);
      });

      // Educational Tiles Floating Oscillation
      bookTile.position.y = 0.65 + Math.sin(elapsedTime * 1.5) * 0.06;
      bookTile.rotation.y = 0.32 + Math.sin(elapsedTime * 1.2) * 0.06;

      codeTile.position.y = -0.48 + Math.cos(elapsedTime * 1.6 + 1) * 0.06;
      codeTile.rotation.y = 0.28 + Math.cos(elapsedTime * 1.3) * 0.06;

      flaskTile.position.y = -0.15 + Math.sin(elapsedTime * 1.4 + 2) * 0.06;
      flaskTile.rotation.y = -0.30 + Math.sin(elapsedTime * 1.1) * 0.06;

      globeTile.position.y = -0.80 + Math.cos(elapsedTime * 1.7 + 3) * 0.06;
      globeTile.rotation.y = -0.26 + Math.cos(elapsedTime * 1.4) * 0.06;

      // Chest Reactor Core Breathing Glow
      const pulse = 1 + Math.sin(elapsedTime * 3) * 0.08;
      cyanRingMesh.scale.set(pulse, pulse, 1);
      purpleRingMesh.scale.set(pulse, pulse, 1);

      renderer.render(scene, camera);
    };

    animate();

    // -------------------------------------------------------------------------
    // 9. Cleanup & Memory Deallocation
    // -------------------------------------------------------------------------
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('click', handleClick);

      faceTexture.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [isDarkMode]);

  return (
    <div 
      className={`relative flex flex-col items-center justify-center select-none pointer-events-auto w-full ${className}`}
      style={{
        background: 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
      }}
    >
      <div
        ref={mountRef}
        title="ClassroomLM AI Teacher · Click to interact"
        className="w-[360px] sm:w-[560px] md:w-[740px] lg:w-[860px] xl:w-[940px] max-w-[min(98vw,960px)] h-[320px] sm:h-[420px] md:h-[480px] lg:h-[540px] cursor-default transition-transform duration-300"
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          touchAction: 'pan-y',
        }}
      />
    </div>
  );
}
