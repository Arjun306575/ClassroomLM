import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface FuturisticTeacher3DProps {
  pose?: string;
  isSpeaking: boolean;
  analyserRef?: React.RefObject<AnalyserNode | null>;
  className?: string;
}

export function FuturisticTeacher3D({
  pose = 'neutral',
  isSpeaking,
  analyserRef,
  className = '',
}: FuturisticTeacher3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const poseRef = useRef(pose);
  poseRef.current = pose;

  const analyserPropRef = useRef(analyserRef);
  analyserPropRef.current = analyserRef;

  const [interactiveEmotion, setInteractiveEmotion] = useState<string>('idle');

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Clean any prior children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 340;

    // 1. Scene, Camera, and Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 4.3);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 2. Lighting System (Futuristic Cyber-Studio)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(2.5, 3.5, 3.0);
    scene.add(keyLight);

    // Cyan Neon Rim Light (Left)
    const cyanRim = new THREE.PointLight(0x00f0ff, 3.2, 8.0);
    cyanRim.position.set(-2.2, 1.2, 1.5);
    scene.add(cyanRim);

    // Magenta Neon Rim Light (Right)
    const magentaRim = new THREE.PointLight(0xd946ef, 3.0, 8.0);
    magentaRim.position.set(2.2, 1.2, -1.0);
    scene.add(magentaRim);

    // Upward Thruster Uplight
    const thrusterLight = new THREE.PointLight(0x38bdf8, 2.4, 4.5);
    thrusterLight.position.set(0, -1.2, 0.4);
    scene.add(thrusterLight);

    // 3. Materials
    const pearlWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.1,
    });

    const deepSlateMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.8,
    });

    const silverMetalMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      roughness: 0.2,
      metalness: 0.85,
    });

    const goldAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.9,
    });

    const cyanNeonMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    });

    const magentaNeonMat = new THREE.MeshBasicMaterial({
      color: 0xd946ef,
    });

    // 4. Mascot Root & Floating Group
    const mascotRoot = new THREE.Group();
    scene.add(mascotRoot);

    const floatingGroup = new THREE.Group();
    mascotRoot.add(floatingGroup);

    // 5. Head Group (with look-at and helmet)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.42, 0);
    floatingGroup.add(headGroup);

    // Outer Helmet (Pearlescent white sphere-capsule)
    const helmetGeom = new THREE.SphereGeometry(0.58, 32, 28);
    helmetGeom.scale(1.05, 1.0, 1.02);
    const helmetMesh = new THREE.Mesh(helmetGeom, pearlWhiteMat);
    helmetMesh.castShadow = true;
    headGroup.add(helmetMesh);

    // Helmet Top Antenna / Cyber-Spire
    const antennaStemGeom = new THREE.CylinderGeometry(0.015, 0.02, 0.22, 12);
    const antennaStem = new THREE.Mesh(antennaStemGeom, silverMetalMat);
    antennaStem.position.set(0, 0.65, 0);
    headGroup.add(antennaStem);

    const antennaTipGeom = new THREE.SphereGeometry(0.04, 12, 12);
    const antennaTip = new THREE.Mesh(antennaTipGeom, cyanNeonMat);
    antennaTip.position.set(0, 0.77, 0);
    headGroup.add(antennaTip);

    // Dual Headphone Cyber Earpieces
    const earpieceGeom = new THREE.CylinderGeometry(0.18, 0.20, 0.12, 24);
    earpieceGeom.rotateZ(Math.PI / 2);

    const earLeft = new THREE.Mesh(earpieceGeom, deepSlateMat);
    earLeft.position.set(-0.62, 0.02, 0.02);
    headGroup.add(earLeft);

    const earRight = new THREE.Mesh(earpieceGeom, deepSlateMat);
    earRight.position.set(0.62, 0.02, 0.02);
    headGroup.add(earRight);

    // Glowing Neon Rings on Earpieces
    const earRingGeom = new THREE.TorusGeometry(0.14, 0.018, 12, 32);
    earRingGeom.rotateY(Math.PI / 2);

    const earRingLeft = new THREE.Mesh(earRingGeom, cyanNeonMat);
    earRingLeft.position.set(-0.68, 0.02, 0.02);
    headGroup.add(earRingLeft);

    const earRingRight = new THREE.Mesh(earRingGeom, magentaNeonMat);
    earRingRight.position.set(0.68, 0.02, 0.02);
    headGroup.add(earRingRight);

    // 6. Dynamic Visor Canvas & Face Display
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = 512;
    faceCanvas.height = 384;
    const faceCtx = faceCanvas.getContext('2d')!;

    const faceTexture = new THREE.CanvasTexture(faceCanvas);
    faceTexture.minFilter = THREE.LinearFilter;
    faceTexture.magFilter = THREE.LinearFilter;

    // Curved Visor Mesh placed flush on front of helmet
    const visorGeom = new THREE.SphereGeometry(0.56, 32, 24, 0, Math.PI);
    visorGeom.rotateY(-Math.PI / 2);
    visorGeom.scale(1.03, 0.88, 1.04);
    visorGeom.translate(0, -0.02, 0.05);

    const visorMat = new THREE.MeshStandardMaterial({
      map: faceTexture,
      roughness: 0.1,
      metalness: 0.3,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.8,
      emissiveMap: faceTexture,
      transparent: true,
      opacity: 0.96,
    });
    const visorMesh = new THREE.Mesh(visorGeom, visorMat);
    headGroup.add(visorMesh);

    // Helper: Draw OLED Cybernetic Eyes & Talking Viseme Mouth on Canvas
    const drawFace = (mouthEnergy: number, eyeExpression: string, blink: boolean) => {
      faceCtx.clearRect(0, 0, 512, 384);

      // Dark futuristic glass visor background with subtle hexagonal grid tint
      faceCtx.fillStyle = '#050b14';
      faceCtx.fillRect(0, 0, 512, 384);

      // Subtle cyan horizon glow
      const grad = faceCtx.createRadialGradient(256, 180, 20, 256, 180, 240);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.18)');
      grad.addColorStop(1, 'rgba(5, 11, 20, 0.0)');
      faceCtx.fillStyle = grad;
      faceCtx.fillRect(0, 0, 512, 384);

      // Draw Eyes (Left & Right)
      const drawEye = (x: number, y: number, isRight: boolean) => {
        faceCtx.save();
        faceCtx.translate(x, y);

        if (blink) {
          // Blinking slit
          faceCtx.strokeStyle = '#00f0ff';
          faceCtx.lineWidth = 6;
          faceCtx.lineCap = 'round';
          faceCtx.beginPath();
          faceCtx.moveTo(-36, 0);
          faceCtx.lineTo(36, 0);
          faceCtx.stroke();
        } else if (eyeExpression === 'happy' || eyeExpression === 'celebrating') {
          // Curved happy upward arc eyes (^ _ ^)
          faceCtx.strokeStyle = '#00f0ff';
          faceCtx.lineWidth = 8;
          faceCtx.lineCap = 'round';
          faceCtx.beginPath();
          faceCtx.arc(0, 8, 32, Math.PI * 1.15, Math.PI * 1.85);
          faceCtx.stroke();

          // Sparkle dot above eye
          faceCtx.fillStyle = '#fde047';
          faceCtx.beginPath();
          faceCtx.arc(0, -28, 4, 0, Math.PI * 2);
          faceCtx.fill();
        } else if (eyeExpression === 'thinking') {
          // Thoughtful upward tilted eyes with scan reticle
          faceCtx.strokeStyle = '#38bdf8';
          faceCtx.lineWidth = 6;
          faceCtx.strokeRect(-28, -20, 56, 40);

          faceCtx.fillStyle = '#00f0ff';
          faceCtx.beginPath();
          faceCtx.arc(isRight ? -4 : 4, -8, 8, 0, Math.PI * 2);
          faceCtx.fill();
        } else {
          // Default / Explaining: Sleek digital pill-shaped LED eyes with inner pupil
          faceCtx.fillStyle = '#00f0ff';
          faceCtx.shadowColor = '#00f0ff';
          faceCtx.shadowBlur = 18;

          // Eye base pill
          faceCtx.beginPath();
          const r = 16;
          const w = 54;
          const h = 42;
          faceCtx.roundRect(-w / 2, -h / 2, w, h, r);
          faceCtx.fill();

          // Inner brighter pupil
          faceCtx.fillStyle = '#ffffff';
          faceCtx.beginPath();
          faceCtx.arc(0, 0, 9, 0, Math.PI * 2);
          faceCtx.fill();
        }

        faceCtx.restore();
      };

      drawEye(168, 145, false);
      drawEye(344, 145, true);

      // Draw Mouth (Dynamic Audio Waveform Viseme when speaking, gentle smile when idle)
      faceCtx.save();
      faceCtx.translate(256, 260);

      if (mouthEnergy > 0.05) {
        // Active speaking: animated dynamic futuristic soundwave / viseme
        const bars = 9;
        const spacing = 14;
        const totalW = (bars - 1) * spacing;
        faceCtx.strokeStyle = '#00f0ff';
        faceCtx.shadowColor = '#00f0ff';
        faceCtx.shadowBlur = 14;
        faceCtx.lineWidth = 5;
        faceCtx.lineCap = 'round';

        for (let i = 0; i < bars; i++) {
          const bx = -totalW / 2 + i * spacing;
          // Symmetric wave height based on energy
          const centerDist = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
          const barH = Math.max(6, Math.min(48, mouthEnergy * 58 * (0.4 + centerDist * 0.6)));

          faceCtx.beginPath();
          faceCtx.moveTo(bx, -barH / 2);
          faceCtx.lineTo(bx, barH / 2);
          faceCtx.stroke();
        }
      } else {
        // Idle gentle curved neon blue smile
        faceCtx.strokeStyle = '#00f0ff';
        faceCtx.shadowColor = '#00f0ff';
        faceCtx.shadowBlur = 10;
        faceCtx.lineWidth = 5;
        faceCtx.lineCap = 'round';
        faceCtx.beginPath();
        faceCtx.arc(0, -10, 32, Math.PI * 0.22, Math.PI * 0.78);
        faceCtx.stroke();
      }

      faceCtx.restore();
      faceTexture.needsUpdate = true;
    };

    // Initial face render
    drawFace(0, 'idle', false);

    // 7. Torso & Cybernetic Chest Plate
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, -0.28, 0);
    floatingGroup.add(torsoGroup);

    const chestGeom = new THREE.CylinderGeometry(0.42, 0.32, 0.72, 24);
    const chestMesh = new THREE.Mesh(chestGeom, pearlWhiteMat);
    chestMesh.castShadow = true;
    torsoGroup.add(chestMesh);

    // Collar / Neck Ring
    const collarGeom = new THREE.TorusGeometry(0.38, 0.035, 12, 28);
    collarGeom.rotateX(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeom, silverMetalMat);
    collarMesh.position.set(0, 0.34, 0);
    torsoGroup.add(collarMesh);

    // Chest Arc Reactor Core (Glowing Cyan with Gold Bezel)
    const reactorBezelGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24);
    reactorBezelGeom.rotateX(Math.PI / 2);
    const reactorBezel = new THREE.Mesh(reactorBezelGeom, goldAccentMat);
    reactorBezel.position.set(0, 0.12, 0.38);
    torsoGroup.add(reactorBezel);

    const reactorCoreGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 24);
    reactorCoreGeom.rotateX(Math.PI / 2);
    const reactorCoreMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const reactorCore = new THREE.Mesh(reactorCoreGeom, reactorCoreMat);
    reactorCore.position.set(0, 0.12, 0.39);
    torsoGroup.add(reactorCore);

    // 8. Arms & Teaching Accessories
    // LEFT ARM (holding holographic tablet)
    const armLeftGroup = new THREE.Group();
    armLeftGroup.position.set(-0.46, 0.12, 0);
    torsoGroup.add(armLeftGroup);

    const shoulderLGeom = new THREE.SphereGeometry(0.12, 16, 16);
    const shoulderL = new THREE.Mesh(shoulderLGeom, deepSlateMat);
    armLeftGroup.add(shoulderL);

    const forearmLGeom = new THREE.CylinderGeometry(0.07, 0.065, 0.38, 14);
    forearmLGeom.translate(0, -0.19, 0);
    const forearmL = new THREE.Mesh(forearmLGeom, pearlWhiteMat);
    forearmL.rotation.set(0.4, 0.2, 0.5);
    armLeftGroup.add(forearmL);

    // Floating Cyber Tablet
    const tabletGeom = new THREE.BoxGeometry(0.34, 0.48, 0.024);
    const tabletMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.9,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.9,
    });
    const tabletMesh = new THREE.Mesh(tabletGeom, tabletMat);
    tabletMesh.position.set(-0.36, -0.15, 0.34);
    tabletMesh.rotation.set(-0.35, 0.45, -0.2);
    torsoGroup.add(tabletMesh);

    // RIGHT ARM (Teaching Pointer Stylus that points toward chalkboard)
    const armRightGroup = new THREE.Group();
    armRightGroup.position.set(0.46, 0.12, 0);
    torsoGroup.add(armRightGroup);

    const shoulderR = new THREE.Mesh(shoulderLGeom, deepSlateMat);
    armRightGroup.add(shoulderR);

    const forearmRGeom = new THREE.CylinderGeometry(0.07, 0.065, 0.42, 14);
    forearmRGeom.translate(0, -0.21, 0);
    const forearmR = new THREE.Mesh(forearmRGeom, pearlWhiteMat);
    forearmR.rotation.set(-0.4, -0.2, -0.7);
    armRightGroup.add(forearmR);

    // Glowing Laser Pointer Stylus
    const stylusGeom = new THREE.CylinderGeometry(0.015, 0.02, 0.52, 14);
    stylusGeom.translate(0, 0.26, 0);
    const stylusMesh = new THREE.Mesh(stylusGeom, silverMetalMat);
    stylusMesh.position.set(0.34, -0.18, 0.28);
    stylusMesh.rotation.set(-0.4, 0.2, -0.8);
    armRightGroup.add(stylusMesh);

    const stylusTipGeom = new THREE.SphereGeometry(0.038, 14, 14);
    const stylusTipMesh = new THREE.Mesh(stylusTipGeom, cyanNeonMat);
    stylusTipMesh.position.set(0.48, 0.18, 0.48);
    armRightGroup.add(stylusTipMesh);

    // 9. Dual Gyroscope Orbit Rings (Cybernetic Aura)
    const gyroGroup = new THREE.Group();
    mascotRoot.add(gyroGroup);

    const gyroRing1Geom = new THREE.TorusGeometry(1.35, 0.018, 12, 64);
    const gyroRing1 = new THREE.Mesh(gyroRing1Geom, cyanNeonMat);
    gyroRing1.rotation.set(Math.PI / 3.4, 0.2, 0);
    gyroGroup.add(gyroRing1);

    const gyroRing2Geom = new THREE.TorusGeometry(1.48, 0.016, 12, 64);
    const gyroRing2 = new THREE.Mesh(gyroRing2Geom, magentaNeonMat);
    gyroRing2.rotation.set(-Math.PI / 3.8, -0.3, 0);
    gyroGroup.add(gyroRing2);

    // 10. Base Holographic Pedestal & Ion Thruster
    const thrusterConeGeom = new THREE.ConeGeometry(0.24, 0.48, 24);
    const thrusterConeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
    });
    const thrusterPlume = new THREE.Mesh(thrusterConeGeom, thrusterConeMat);
    thrusterPlume.rotation.x = Math.PI;
    thrusterPlume.position.set(0, -0.85, 0);
    floatingGroup.add(thrusterPlume);

    // Hologram Base Ring on ground
    const baseRingGeom = new THREE.TorusGeometry(0.68, 0.024, 12, 48);
    baseRingGeom.rotateX(Math.PI / 2);
    const baseRingMesh = new THREE.Mesh(baseRingGeom, cyanNeonMat);
    baseRingMesh.position.set(0, -1.35, 0);
    mascotRoot.add(baseRingMesh);

    // 11. Mouse / Cursor Look-At Tracker
    const mousePos = { x: 0, y: 0 };
    const targetHeadRot = { x: 0, y: 0 };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);

      mousePos.x = Math.max(-1.5, Math.min(1.5, ndcX));
      mousePos.y = Math.max(-1.2, Math.min(1.2, ndcY));
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });

    // Click on teacher for playful wave / reaction
    const handleClick = () => {
      setInteractiveEmotion('celebrating');
      setTimeout(() => setInteractiveEmotion('idle'), 2400);
    };
    container.addEventListener('click', handleClick);

    // 12. Animation Loop
    let animId = 0;
    let clock = new THREE.Clock();
    let blinkTimer = 0;
    let isBlinking = false;
    let speechSmoothEnergy = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Read audio spectrum energy if speaking
      let currentEnergy = 0;
      if (isSpeakingRef.current) {
        const analyser = analyserPropRef.current?.current;
        if (analyser) {
          try {
            const freqData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(freqData);
            let sum = 0;
            const count = Math.min(freqData.length, 32);
            for (let i = 1; i < count; i++) {
              sum += freqData[i];
            }
            currentEnergy = sum / (count - 1) / 255;
          } catch (e) {
            currentEnergy = 0.5 + Math.sin(elapsed * 12) * 0.3;
          }
        } else {
          // Synthetic procedural speech cadence if analyser not attached
          currentEnergy = 0.45 + Math.sin(elapsed * 14) * 0.35 * Math.sin(elapsed * 7);
        }
      }

      // Smooth speech energy with low-pass filter
      speechSmoothEnergy += (currentEnergy - speechSmoothEnergy) * 0.35;

      // Natural Eye Blinking Logic
      blinkTimer += dt;
      if (!isBlinking && blinkTimer > 3.8 + Math.sin(elapsed) * 1.5) {
        isBlinking = true;
        blinkTimer = 0;
      } else if (isBlinking && blinkTimer > 0.16) {
        isBlinking = false;
        blinkTimer = 0;
      }

      // Update Visor Face Texture
      const currentPose = poseRef.current;
      drawFace(speechSmoothEnergy, currentPose, isBlinking);

      // Smooth Floating Levitation Motion (Hover)
      floatingGroup.position.y = Math.sin(elapsed * 2.2) * 0.08;
      floatingGroup.rotation.z = Math.sin(elapsed * 1.6) * 0.025;

      // Pointer arm gesture: lifts towards chalkboard when speaking or explaining
      if (isSpeakingRef.current || currentPose === 'explaining') {
        const gestureLift = Math.sin(elapsed * 3.5) * 0.08;
        armRightGroup.rotation.z = -0.3 + gestureLift;
        armRightGroup.rotation.x = -0.25 + Math.cos(elapsed * 2.5) * 0.05;
      } else {
        armRightGroup.rotation.z = THREE.MathUtils.lerp(armRightGroup.rotation.z, 0, 0.1);
        armRightGroup.rotation.x = THREE.MathUtils.lerp(armRightGroup.rotation.x, 0, 0.1);
      }

      // Tablet hover motion
      tabletMesh.position.y = -0.15 + Math.sin(elapsed * 3.0) * 0.03;

      // Gyroscope Aura Rings Continuous Orbit
      gyroRing1.rotation.z = elapsed * 0.35;
      gyroRing2.rotation.z = -elapsed * 0.28;

      // Thruster Plume Pulse
      const plumeScale = 1 + Math.sin(elapsed * 12) * 0.22;
      thrusterPlume.scale.set(plumeScale, plumeScale * 1.1, plumeScale);

      // Chest Reactor Core Breathing Glow
      const corePulse = 1 + Math.sin(elapsed * 4.0) * 0.12;
      reactorCore.scale.set(corePulse, corePulse, 1);

      // Cursor / Head Tracking with damping
      targetHeadRot.y = THREE.MathUtils.lerp(targetHeadRot.y, mousePos.x * 0.38, 0.08);
      targetHeadRot.x = THREE.MathUtils.lerp(targetHeadRot.x, -mousePos.y * 0.25, 0.08);

      headGroup.rotation.y = targetHeadRot.y;
      headGroup.rotation.x = targetHeadRot.x;

      renderer.render(scene, camera);
    };

    animate();

    // 13. Responsive Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 240;
      const newH = container.clientHeight || 340;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // 14. Cleanup & Resource Disposal
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('click', handleClick);

      faceTexture.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-end select-none pointer-events-auto ${className}`}
      style={{
        background: 'transparent',
        border: 'none',
        outline: 'none',
      }}
    >
      <div
        ref={mountRef}
        title="ClassroomLM Quantum AI Teacher · Interactive 3D WebGL Avatar"
        className="w-full h-56 sm:h-64 md:h-72 lg:h-80 cursor-pointer"
        style={{
          background: 'transparent',
          touchAction: 'pan-y',
        }}
      />
    </div>
  );
}
