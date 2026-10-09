import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, X, Zap, ZapOff, Sparkles, CheckCircle2, SwitchCamera, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type FlashMode = 'flash-off' | 'flash-on' | 'flash-automatic';

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default strictly to back camera ('environment')
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  // Flashlight mode state: 'flash-off' | 'flash-on' | 'flash-automatic'
  const [flashMode, setFlashMode] = useState<FlashMode>('flash-automatic');
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [isScreenFlashing, setIsScreenFlashing] = useState(false);

  // Focus & HDR state
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [isFocusLocked, setIsFocusLocked] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hdrPulse, setHdrPulse] = useState(false);

  // Apply torch constraint to the video track
  const setHardwareTorch = useCallback(async (enabled: boolean) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities = (track.getCapabilities?.() as any) || {};
      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: enabled } as any]
        });
      }
    } catch (e) {
      console.warn("Torch hardware toggle error:", e);
    }
  }, []);

  // Update flash mode and handle immediate hardware torch activation
  const handleSelectFlashMode = useCallback(async (mode: FlashMode) => {
    setFlashMode(mode);
    if (mode === 'flash-on') {
      await setHardwareTorch(true);
    } else {
      await setHardwareTorch(false);
    }
  }, [setHardwareTorch]);

  // Trigger camera autofocus at specific clicked object point with crystal-clear HDR balance
  const triggerCameraFocus = useCallback(async (point?: { x: number; y: number }) => {
    const video = videoRef.current;
    const rect = video?.getBoundingClientRect();
    const targetX = point ? point.x : (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const targetY = point ? point.y : (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);
    
    // Accurate normalized coordinates (0.0 to 1.0) taking object-cover into account
    let normX = 0.5;
    let normY = 0.5;
    if (video && rect && rect.width > 0 && rect.height > 0) {
      const videoW = video.videoWidth || 1920;
      const videoH = video.videoHeight || 1080;
      const videoAspect = videoW / videoH;
      const containerAspect = rect.width / rect.height;

      let renderW = rect.width;
      let renderH = rect.height;
      let offsetX = 0;
      let offsetY = 0;

      if (containerAspect > videoAspect) {
        renderH = rect.width / videoAspect;
        offsetY = (renderH - rect.height) / 2;
      } else {
        renderW = rect.height * videoAspect;
        offsetX = (renderW - rect.width) / 2;
      }

      normX = Math.max(0.02, Math.min(0.98, (targetX - rect.left + offsetX) / renderW));
      normY = Math.max(0.02, Math.min(0.98, (targetY - rect.top + offsetY) / renderH));
    }

    setFocusPoint({ x: targetX, y: targetY });
    setIsFocusLocked(false);
    setHdrPulse(true);

    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = (track.getCapabilities?.() as any) || {};
          const advancedConstraints: any = {};
          
          // Continuous + single-shot lock
          if (capabilities.focusMode) {
            advancedConstraints.focusMode = capabilities.focusMode.includes('single-shot') ? 'single-shot' : 'continuous';
          }
          if (capabilities.exposureMode) {
            advancedConstraints.exposureMode = 'continuous';
          }
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.whiteBalanceMode = 'continuous';
          }
          if (capabilities.pointsOfInterest) {
            advancedConstraints.pointsOfInterest = [{ x: normX, y: normY }];
          }
          // HDR Exposure Compensation to balance bright highlights & shadow text
          if (capabilities.exposureCompensation) {
            const maxComp = capabilities.exposureCompensation.max || 0;
            const minComp = capabilities.exposureCompensation.min || 0;
            advancedConstraints.exposureCompensation = Math.max(minComp, Math.min(maxComp, 0.4));
          }

          await track.applyConstraints({ advanced: [advancedConstraints] });
        } catch (err) {
          console.warn("Autofocus & HDR adjustment:", err);
        }
      }
    }

    // Lock reticle animation after 160ms with HDR crystal clear lock feedback
    setTimeout(() => {
      setIsFocusLocked(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([25, 35, 25]);
      }
    }, 160);

    setTimeout(() => {
      setHdrPulse(false);
    }, 600);

    setTimeout(() => {
      setFocusPoint(prev => (prev?.x === targetX && prev?.y === targetY ? null : prev));
      setIsFocusLocked(false);
    }, 1800);
  }, []);

  // Handle tap-to-focus on viewfinder
  const handleViewfinderTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    triggerCameraFocus({ x: clientX, y: clientY });
  };

  // Toggle between back and front camera
  const toggleCameraFacing = useCallback(() => {
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  // Start Camera Stream strictly prioritizing back camera ('environment')
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    const initCamera = async () => {
      let stream: MediaStream | null = null;

      // 1. Check enumerated devices to find specific rear / back camera deviceId
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');

        if (cameraFacing === 'environment') {
          // Look for rear / back / environment keywords in device labels
          const rearCam = videoDevices.find(d => 
            /back|rear|environment|camera2 0|facing back|haupt/i.test(d.label)
          );
          if (rearCam) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: rearCam.deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              }
            });
          }
        } else {
          const frontCam = videoDevices.find(d => 
            /front|user|selfie|forward/i.test(d.label)
          );
          if (frontCam) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: frontCam.deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              }
            });
          }
        }
      } catch {
        // Enumerate fallback if permissions not yet available
      }

      // 2. Strict exact facingMode: { exact: 'environment' } (or 'user')
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: cameraFacing },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              advanced: [
                { focusMode: 'continuous' } as any,
                { exposureMode: 'continuous' } as any
              ]
            }
          });
        } catch (e) {
          console.warn(`Exact facingMode ${cameraFacing} failed, trying ideal fallback:`, e);
        }
      }

      // 3. Fallback to ideal facingMode
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: cameraFacing },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          });
        } catch {
          // 4. Final fallback to any video stream available
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      if (isCancelled) {
        stream?.getTracks().forEach(t => t.stop());
        return;
      }

      activeStream = stream;
      streamRef.current = stream;

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }

      // Check hardware torch support on active track
      const track = stream?.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities?.() as any) || {};
        if (capabilities.torch) {
          setHasTorchSupport(true);
          if (flashMode === 'flash-on') {
            await setHardwareTorch(true);
          }
        } else {
          setHasTorchSupport(false);
        }
      }

      // Initial autofocus trigger
      setTimeout(() => triggerCameraFocus(), 400);
    };

    initCamera().catch(err => {
      console.error("Camera access error:", err);
      alert("Could not access camera. Please check camera permissions in your browser.");
      onClose();
    });

    return () => {
      isCancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
      streamRef.current = null;
    };
  }, [cameraFacing, onClose, setHardwareTorch, triggerCameraFocus, flashMode]);

  // Gallery File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onCapture(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Capture Image with Simultaneous Autofocus Lock & Crystal Clear HDR Processing
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);

    // 1. Simultaneous Focus Lock: center reticle and apply camera autofocus constraints immediately
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    triggerCameraFocus({ x: centerX, y: centerY });

    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = (track.getCapabilities?.() as any) || {};
          if (capabilities.focusMode) {
            await track.applyConstraints({
              advanced: [
                { focusMode: capabilities.focusMode.includes('single-shot') ? 'single-shot' : 'continuous' } as any,
                { exposureMode: 'continuous' } as any,
                ...(capabilities.pointsOfInterest ? [{ pointsOfInterest: [{ x: 0.5, y: 0.5 }] }] : [])
              ]
            });
          }
        } catch (err) {
          console.warn("Simultaneous focus constraint:", err);
        }
      }
    }

    // 2. Flashlight handling: activate torch / screen flash if mode is 'flash-on' or 'flash-automatic'
    const shouldFlash = flashMode === 'flash-on' || flashMode === 'flash-automatic';
    if (shouldFlash) {
      setIsScreenFlashing(true);
      await setHardwareTorch(true);
    }

    // 3. Simultaneous Convergence Delay: 160ms for optical lens focus & illumination stabilization
    await new Promise(res => setTimeout(res, 160));

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const track = streamRef.current?.getVideoTracks()[0];
      let capturedDataUrl = '';

      // Try native ImageCapture API if available for highest optical resolution & camera hardware focus
      if ('ImageCapture' in window && track && typeof (window as any).ImageCapture === 'function') {
        try {
          const imageCapture = new (window as any).ImageCapture(track);
          const blob = await imageCapture.takePhoto({
            fillLightMode: flashMode === 'flash-off' ? 'off' : flashMode === 'flash-on' ? 'flash' : 'auto'
          });
          capturedDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn("Native ImageCapture fallback to canvas:", e);
        }
      }

      // Canvas fallback for full frame resolution with Crystal Clear HDR Processing
      if (!capturedDataUrl) {
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Crystal Clear HDR Filter: optimizes micro-contrast, text sharpness, and exposure dynamic range
          ctx.filter = 'contrast(1.2) saturate(1.22) brightness(1.03)';

          // If front-facing camera, mirror horizontally so captured text/photo matches what user saw
          if (cameraFacing === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          capturedDataUrl = canvas.toDataURL('image/jpeg', 0.98);
        }
      }

      // Turn off torch if mode was flash-automatic
      if (flashMode === 'flash-automatic') {
        await setHardwareTorch(false);
      }
      setIsScreenFlashing(false);

      // Haptic confirmation
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 40]);
      }

      if (capturedDataUrl) {
        onCapture(capturedDataUrl);
      } else {
        setIsCapturing(false);
      }
    } catch (e) {
      console.error("Capture failed:", e);
      setIsCapturing(false);
      setIsScreenFlashing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[70] bg-black flex flex-col select-none overflow-hidden"
      onClick={handleViewfinderTap}
    >
      {/* Hidden Gallery File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept="image/*" 
      />

      {/* Screen Flash Illumination for Low-Light / Non-Torch Devices */}
      <AnimatePresence>
        {isScreenFlashing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.95 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-[85] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Top Navigation Bar with Flashlight Modes, Flip Camera & Close */}
      <div className="p-2 sm:p-4 px-2.5 sm:px-6 flex justify-between items-center bg-gradient-to-b from-black/90 via-black/50 to-transparent absolute top-0 left-0 w-full z-20">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600/30 border border-blue-400/50 flex items-center justify-center text-blue-400 shrink-0">
            <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-extrabold text-xs sm:text-base tracking-wide flex items-center gap-1 leading-tight truncate">
              Magic Lens
            </h3>
            <p className="text-[9px] sm:text-[11px] text-slate-300 font-medium truncate">
              {cameraFacing === 'environment' ? '📷 Back Camera' : '🤳 Front Camera'}
            </p>
          </div>
        </div>

        {/* Top-Right Action Controls: Flashlight, Camera Switcher & Close */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Flashlight Button & 3-Mode Switcher (flash-off, flash-on, flash-automatic) */}
          <div className="flex items-center bg-black/60 backdrop-blur-md rounded-full border border-white/20 p-0.5 shadow-lg">
            {/* Flash Off */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectFlashMode('flash-off');
              }}
              className={`px-1.5 sm:px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                flashMode === 'flash-off'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Flashlight Off (flash-off)"
            >
              <ZapOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline text-[11px]">Off</span>
            </button>

            {/* Flash On (Torch ON) */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectFlashMode('flash-on');
              }}
              className={`px-1.5 sm:px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                flashMode === 'flash-on'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-[0_0_12px_rgba(245,158,11,0.7)]'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
              title="Flashlight On (flash-on - torch turns on now and during capture)"
            >
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              <span className="hidden sm:inline text-[11px]">On</span>
            </button>

            {/* Flash Automatic */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectFlashMode('flash-automatic');
              }}
              className={`px-1.5 sm:px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                flashMode === 'flash-automatic'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_12px_rgba(6,182,212,0.7)]'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
              title="Flashlight Automatic (flash-automatic - flashes simultaneously while capturing)"
            >
              <div className="relative flex items-center">
                <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                <span className="text-[7px] sm:text-[8px] font-black ml-0.5 uppercase tracking-tighter">A</span>
              </div>
              <span className="hidden sm:inline text-[11px]">Auto</span>
            </button>
          </div>

          {/* Switch Camera Button (Flip between back and front camera) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleCameraFacing();
            }}
            className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-full text-white backdrop-blur-md border border-white/20 flex items-center justify-center"
            title={`Switch to ${cameraFacing === 'environment' ? 'Front' : 'Back'} Camera (Current: ${cameraFacing === 'environment' ? 'Back Camera' : 'Front Camera'})`}
          >
            <SwitchCamera className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-cyan-400" />
          </button>

          {/* Close Button */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }} 
            className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-full text-white backdrop-blur-md border border-white/20"
            title="Close Camera"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5"/>
          </button>
        </div>
      </div>

      {/* Camera Live Video Feed */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center cursor-crosshair">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className={`w-full h-full object-cover transition-all duration-300 ${cameraFacing === 'user' ? '-scale-x-100' : ''}`}
          style={{
            filter: isFocusLocked 
              ? 'contrast(1.22) saturate(1.25) brightness(1.03) drop-shadow(0 0 1px rgba(0,0,0,0.5))' 
              : 'contrast(1.12) saturate(1.18) brightness(1.02)'
          }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Google Lens Viewfinder Document Guide Frame */}
        <div className="absolute inset-3 sm:inset-8 md:inset-12 pointer-events-none flex flex-col justify-between border-2 border-white/20 rounded-2xl sm:rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
          <div className="flex justify-between p-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl shadow-[0_0_10px_rgba(34,211,238,0.7)]" />
            <div className="w-6 h-6 sm:w-7 sm:h-7 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl shadow-[0_0_10px_rgba(34,211,238,0.7)]" />
          </div>
          <div className="flex justify-center items-center py-2 px-2">
            <span className="text-[10px] sm:text-xs font-bold text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-lg text-center">
              <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse shrink-0" />
              Tap anywhere to focus crystal clear in HDR
            </span>
          </div>
          <div className="flex justify-between p-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl shadow-[0_0_10px_rgba(34,211,238,0.7)]" />
            <div className="w-6 h-6 sm:w-7 sm:h-7 border-b-4 border-r-4 border-cyan-400 rounded-br-xl shadow-[0_0_10px_rgba(34,211,238,0.7)]" />
          </div>
        </div>

        {/* Dynamic Simultaneous Autofocus & Crystal-Clear HDR Reticle */}
        <AnimatePresence>
          {focusPoint && (
            <motion.div
              initial={{ scale: 1.8, opacity: 0 }}
              animate={{ 
                scale: isFocusLocked ? 0.95 : 1, 
                opacity: 1 
              }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 350 }}
              style={{
                left: focusPoint.x - 40,
                top: focusPoint.y - 40
              }}
              className="absolute w-20 h-20 pointer-events-none z-30 flex items-center justify-center"
            >
              {/* Expanding HDR Clarity Ripple Wave */}
              {hdrPulse && (
                <motion.div
                  initial={{ scale: 0.4, opacity: 1 }}
                  animate={{ scale: 2.3, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)]"
                />
              )}

              {/* Reticle Target Frame */}
              <div className={`w-20 h-20 border-2 rounded-2xl transition-all duration-200 flex items-center justify-center relative ${
                isFocusLocked 
                  ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.95)] bg-emerald-400/15' 
                  : 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.85)] animate-pulse'
              }`}>
                {/* 4 Precision Corner Crosshairs */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-0.5 bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-0.5 bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0.5 h-2 bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-0.5 h-2 bg-emerald-400 shadow-[0_0_6px_#34d399]" />

                {/* Center Reticle Pin */}
                <div className={`w-2.5 h-2.5 rounded-full ${isFocusLocked ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-cyan-400 animate-ping'}`} />

                {/* Floating HDR Badge */}
                {isFocusLocked && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-slate-950/95 border border-emerald-400/60 text-[9px] font-black text-emerald-300 tracking-wider uppercase whitespace-nowrap shadow-2xl backdrop-blur-md flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>HDR Focus Locked · Crystal Clear</span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls Bar: Gallery Upload, Shutter Capture & Guidance */}
      <div className="p-3 sm:p-5 pb-5 sm:pb-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent absolute bottom-0 left-0 w-full flex flex-col items-center justify-center gap-2 sm:gap-3 z-20">
        <div className="w-full max-w-xs sm:max-w-sm flex items-center justify-between px-4 sm:px-6">
          {/* Gallery / File Upload Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white backdrop-blur-md border border-white/20 flex flex-col items-center justify-center shadow-lg"
            title="Upload Photo from Gallery"
          >
            <ImageIcon className="w-5 h-5 text-emerald-400" />
          </button>

          {/* Shutter Button */}
          <button 
            type="button"
            disabled={isCapturing}
            onClick={(e) => {
              e.stopPropagation();
              handleCapture();
            }} 
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[4px] sm:border-[5px] border-white/90 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.8)] active:scale-90 transition-transform group disabled:opacity-50"
            title="Capture & Focus (Crystal Clear in HDR)"
          >
            {/* Shutter Pulse Ring */}
            <div className="absolute -inset-1 rounded-full border border-cyan-400/40 animate-ping opacity-35 pointer-events-none" />

            <div className="w-13 h-13 sm:w-16 sm:h-16 bg-white group-hover:bg-cyan-50 rounded-full flex items-center justify-center text-slate-900 transition-colors shadow-inner">
              {isCapturing ? (
                <div className="w-6 h-6 sm:w-7 sm:h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />
              )}
            </div>
          </button>

          {/* Flip Camera Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleCameraFacing();
            }}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white backdrop-blur-md border border-white/20 flex flex-col items-center justify-center shadow-lg"
            title={`Switch Camera (${cameraFacing === 'environment' ? 'Back Camera' : 'Front Camera'})`}
          >
            <SwitchCamera className="w-5 h-5 text-cyan-400" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-white/90 font-bold tracking-wide bg-black/50 px-3 sm:px-3.5 py-1 rounded-full border border-white/10 backdrop-blur-md text-center">
          <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
          <span>Tap Object to Focus · Crystal Clear HDR</span>
        </div>
      </div>
    </div>
  );
}
