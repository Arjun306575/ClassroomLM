import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Send, Sparkles, Maximize2, Scan, CheckCircle2, RefreshCw, Wand2, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MagicLensCropProps {
  imageUrl: string;
  onComplete: (croppedImage: string, prompt: string) => void;
  onClose: () => void;
}

interface CropBounds {
  unit: '%';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TapIndicator {
  x: number;
  y: number;
  id: number;
}

export function MagicLensCrop({ imageUrl, onComplete, onClose }: MagicLensCropProps) {
  // Crop state in percentage: starts at full 100% of the cropping window
  const [crop, setCrop] = useState<Crop>({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  const [completedCrop, setCompletedCrop] = useState<Crop>({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cachedLumRef = useRef<{ w: number; h: number; lum: Uint8Array } | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number; time: number; isHandle: boolean } | null>(null);

  const [prompt, setPrompt] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isScanning, setIsScanning] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState<string>("Detecting document...");
  const [isDocDetected, setIsDocDetected] = useState(false);
  const [tapIndicator, setTapIndicator] = useState<TapIndicator | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  // Quick prompt suggestions for educational & document analysis
  const quickPrompts = [
    "💡 Solve this problem step-by-step",
    "📝 Summarize main points & key formulas",
    "🔍 Transcribe text & diagrams cleanly",
    "❓ Explain the core concept behind this"
  ];

  // Document & Page Edge Detection Algorithm using offscreen canvas analysis
  const detectDocumentBounds = useCallback((img: HTMLImageElement): CropBounds => {
    try {
      const canvas = document.createElement('canvas');
      const w = 320;
      const h = Math.max(180, Math.round(w * (img.naturalHeight / img.naturalWidth)));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { unit: '%', x: 0, y: 0, width: 100, height: 100 };

      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;

      // Compute luminance array and cache it for instant tap-to-shrink area detection
      const lum = new Uint8Array(w * h);
      for (let i = 0; i < lum.length; i++) {
        const idx = i * 4;
        lum[i] = Math.round(0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]);
      }
      cachedLumRef.current = { w, h, lum };

      // Sample outer perimeter (outer 4% margins) to establish background baseline
      let borderSum = 0;
      let borderCount = 0;
      const marginX = Math.floor(w * 0.04);
      const marginY = Math.floor(h * 0.04);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (x < marginX || x >= w - marginX || y < marginY || y >= h - marginY) {
            borderSum += lum[y * w + x];
            borderCount++;
          }
        }
      }
      const bgLum = borderCount > 0 ? borderSum / borderCount : 128;

      // Scan inward from 4 edges to locate document paper/content boundaries
      const deltaThreshold = 24;
      let minX = 0, maxX = w - 1;
      let minY = 0, maxY = h - 1;

      // Scan Top inward
      for (let y = 0; y < Math.floor(h * 0.42); y++) {
        let diff = 0;
        for (let x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x++) {
          if (Math.abs(lum[y * w + x] - bgLum) > deltaThreshold) diff++;
        }
        if (diff > (w * 0.7) * 0.22) {
          minY = y;
          break;
        }
      }

      // Scan Bottom inward
      for (let y = h - 1; y > Math.floor(h * 0.58); y--) {
        let diff = 0;
        for (let x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x++) {
          if (Math.abs(lum[y * w + x] - bgLum) > deltaThreshold) diff++;
        }
        if (diff > (w * 0.7) * 0.22) {
          maxY = y;
          break;
        }
      }

      // Scan Left inward
      for (let x = 0; x < Math.floor(w * 0.42); x++) {
        let diff = 0;
        for (let y = Math.floor(h * 0.15); y < Math.floor(h * 0.85); y++) {
          if (Math.abs(lum[y * w + x] - bgLum) > deltaThreshold) diff++;
        }
        if (diff > (h * 0.7) * 0.22) {
          minX = x;
          break;
        }
      }

      // Scan Right inward
      for (let x = w - 1; x > Math.floor(w * 0.58); x--) {
        let diff = 0;
        for (let y = Math.floor(h * 0.15); y < Math.floor(h * 0.85); y++) {
          if (Math.abs(lum[y * w + x] - bgLum) > deltaThreshold) diff++;
        }
        if (diff > (h * 0.7) * 0.22) {
          maxX = x;
          break;
        }
      }

      const detectedPctW = ((maxX - minX) / w) * 100;
      const detectedPctH = ((maxY - minY) / h) * 100;

      // If document edges were detected clearly with bounds covering at least 25% of the frame
      if (detectedPctW >= 25 && detectedPctH >= 25 && (detectedPctW < 96 || detectedPctH < 96)) {
        // Add safe 2% breathing margin
        const safeX = Math.max(0, (minX / w) * 100 - 2);
        const safeY = Math.max(0, (minY / h) * 100 - 2);
        const safeW = Math.min(100 - safeX, detectedPctW + 4);
        const safeH = Math.min(100 - safeY, detectedPctH + 4);
        return {
          unit: '%',
          x: Math.round(safeX * 10) / 10,
          y: Math.round(safeY * 10) / 10,
          width: Math.round(safeW * 10) / 10,
          height: Math.round(safeH * 10) / 10
        };
      }

      // Full document / close-up photo: frame cleanly covering full photo with small margin
      return { unit: '%', x: 2, y: 2, width: 96, height: 96 };
    } catch (e) {
      console.warn("Document detection error:", e);
      return { unit: '%', x: 0, y: 0, width: 100, height: 100 };
    }
  }, []);

  // Universal smooth crop box animation transition
  const animateCropTransition = useCallback((
    targetCrop: CropBounds,
    startCropParam?: Crop,
    duration: number = 280,
    onFinished?: () => void
  ) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const startX = startCropParam ? (startCropParam.x ?? 0) : (crop.x ?? 0);
    const startY = startCropParam ? (startCropParam.y ?? 0) : (crop.y ?? 0);
    const startW = startCropParam ? (startCropParam.width ?? 100) : (crop.width ?? 100);
    const startH = startCropParam ? (startCropParam.height ?? 100) : (crop.height ?? 100);

    const startTime = performance.now();

    function animateFrame(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Fast responsive cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);

      const currentX = startX + (targetCrop.x - startX) * ease;
      const currentY = startY + (targetCrop.y - startY) * ease;
      const currentW = startW + (targetCrop.width - startW) * ease;
      const currentH = startH + (targetCrop.height - startH) * ease;

      const intermediateCrop: Crop = {
        unit: '%',
        x: Math.round(currentX * 10) / 10,
        y: Math.round(currentY * 10) / 10,
        width: Math.round(currentW * 10) / 10,
        height: Math.round(currentH * 10) / 10
      };

      setCrop(intermediateCrop);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animateFrame);
      } else {
        setCrop(targetCrop);
        setCompletedCrop(targetCrop);
        if (onFinished) onFinished();
      }
    }

    animFrameRef.current = requestAnimationFrame(animateFrame);
  }, [crop]);

  // Google Lens Animated Transition: starts at 100% outer edges and smoothly contracts to frame detected document
  const triggerGoogleLensTransition = useCallback((targetCrop: CropBounds) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    setIsScanning(true);
    setDetectionStatus("Google Lens scanning document...");
    setIsDocDetected(false);

    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });

    setTimeout(() => {
      animateCropTransition(
        targetCrop,
        { unit: '%', x: 0, y: 0, width: 100, height: 100 },
        600,
        () => {
          setIsScanning(false);
          setIsDocDetected(true);
          setDetectionStatus("Tap any area to shrink crop");

          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(30);
          }
        }
      );
    }, 380);
  }, [animateCropTransition]);

  // Detect local area around a click point to tightly shrink crop around specific question / formula
  const detectLocalArea = useCallback((clickXPct: number, clickYPct: number, isMobile: boolean): CropBounds => {
    const cached = cachedLumRef.current;
    if (cached) {
      const { w, h, lum } = cached;
      const cx = Math.round((clickXPct / 100) * w);
      const cy = Math.round((clickYPct / 100) * h);

      // Search window: +/- 25% horizontal, +/- 15% vertical around click
      const rangeX = Math.round(w * 0.25);
      const rangeY = Math.round(h * 0.15);

      const startX = Math.max(0, cx - rangeX);
      const endX = Math.min(w - 1, cx + rangeX);
      const startY = Math.max(0, cy - rangeY);
      const endY = Math.min(h - 1, cy + rangeY);

      // Estimate local background luminance from perimeter of the search window
      let bgSum = 0;
      let bgCount = 0;
      for (let x = startX; x <= endX; x++) {
        bgSum += lum[startY * w + x];
        bgSum += lum[endY * w + x];
        bgCount += 2;
      }
      for (let y = startY; y <= endY; y++) {
        bgSum += lum[y * w + startX];
        bgSum += lum[y * w + endX];
        bgCount += 2;
      }
      const localBg = bgCount > 0 ? bgSum / bgCount : 128;

      const threshold = 22;
      let minX = endX, maxX = startX, minY = endY, maxY = startY;
      let textPixels = 0;

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const val = lum[y * w + x];
          if (Math.abs(val - localBg) > threshold) {
            textPixels++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // If text/diagram cluster found with decent density
      if (textPixels > 12 && maxX > minX && maxY > minY) {
        const rawW = ((maxX - minX) / w) * 100;
        const rawH = ((maxY - minY) / h) * 100;

        if (rawW >= 7 && rawH >= 3 && rawW <= 75 && rawH <= 50) {
          // Add comfortable breathing margin
          const safeX = Math.max(0.5, (minX / w) * 100 - 2.5);
          const safeY = Math.max(0.5, (minY / h) * 100 - 2.5);
          const safeW = Math.min(99 - safeX, rawW + 5);
          const safeH = Math.min(99 - safeY, rawH + 5);
          return {
            unit: '%',
            x: Math.round(safeX * 10) / 10,
            y: Math.round(safeY * 10) / 10,
            width: Math.round(safeW * 10) / 10,
            height: Math.round(safeH * 10) / 10
          };
        }
      }
    }

    // Default centered compact box if no specific cluster was detected
    const defaultW = isMobile ? 45 : 36;
    const defaultH = isMobile ? 25 : 20;
    const x = Math.max(0.5, Math.min(99.5 - defaultW, clickXPct - defaultW / 2));
    const y = Math.max(0.5, Math.min(99.5 - defaultH, clickYPct - defaultH / 2));
    return {
      unit: '%',
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: defaultW,
      height: defaultH
    };
  }, []);

  // Handle tap / click on a particular area to shrink crop box
  const handleAreaClick = (clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return;
    }

    const clickXPct = ((clientX - rect.left) / rect.width) * 100;
    const clickYPct = ((clientY - rect.top) / rect.height) * 100;

    // Show glowing target reticle pulse at clicked coordinates
    const newId = Date.now();
    setTapIndicator({ x: clickXPct, y: clickYPct, id: newId });
    setTimeout(() => {
      setTapIndicator(prev => (prev && prev.id === newId ? null : prev));
    }, 700);

    // Compute smart local area crop
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const targetCrop = detectLocalArea(clickXPct, clickYPct, isMobile);

    setIsScanning(false);
    setDetectionStatus("Focused on selected area");
    setIsDocDetected(true);

    // Animate bounding box smoothly shrinking to that specific area
    animateCropTransition(targetCrop, crop, 260, () => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const isHandle = (e.target as HTMLElement).closest('.ReactCrop__drag-handle') !== null;
    pointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      isHandle
    };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    const { x: startX, y: startY, time: startTime, isHandle } = pointerDownRef.current;
    pointerDownRef.current = null;

    // If pointer was on a resize handle, user was resizing handles: ignore
    if (isHandle) return;

    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    const elapsed = Date.now() - startTime;

    // Detect click / tap: minimal movement and short duration
    if (dist < 8 && elapsed < 350) {
      handleAreaClick(e.clientX, e.clientY);
    }
  };

  // On image load, compute document bounds and trigger the Google Lens animation
  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const targetCrop = detectDocumentBounds(e.currentTarget);
    triggerGoogleLensTransition(targetCrop);
  }

  // Re-trigger auto-detection transition
  const handleRedetect = () => {
    if (!imgRef.current) return;
    const targetCrop = detectDocumentBounds(imgRef.current);
    triggerGoogleLensTransition(targetCrop);
  };

  // Expand bounding box to 100% full photo coverage
  const handleSelectFullPhoto = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsScanning(false);
    const fullCrop: CropBounds = { unit: '%', x: 0, y: 0, width: 100, height: 100 };
    animateCropTransition(fullCrop, crop, 220, () => {
      setIsDocDetected(false);
      setDetectionStatus("Full photo covered (100%)");
    });
  };

  // Crop image and complete
  const handleConfirm = () => {
    if (!imgRef.current) {
      onComplete(imageUrl, prompt);
      return;
    }

    const image = imgRef.current;
    const activeCrop = completedCrop || crop;

    // If crop covers >= 98% of both axes, use original full image
    if (!activeCrop || (activeCrop.width >= 98 && activeCrop.height >= 98 && activeCrop.x <= 2 && activeCrop.y <= 2)) {
      onComplete(imageUrl, prompt);
      return;
    }

    const canvas = document.createElement('canvas');
    let pixelX = 0, pixelY = 0, pixelW = image.naturalWidth, pixelH = image.naturalHeight;

    if (activeCrop.unit === '%') {
      pixelX = (activeCrop.x / 100) * image.naturalWidth;
      pixelY = (activeCrop.y / 100) * image.naturalHeight;
      pixelW = (activeCrop.width / 100) * image.naturalWidth;
      pixelH = (activeCrop.height / 100) * image.naturalHeight;
    } else {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      pixelX = activeCrop.x * scaleX;
      pixelY = activeCrop.y * scaleY;
      pixelW = activeCrop.width * scaleX;
      pixelH = activeCrop.height * scaleY;
    }

    canvas.width = Math.max(1, Math.round(pixelW));
    canvas.height = Math.max(1, Math.round(pixelH));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onComplete(imageUrl, prompt);
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      pixelX,
      pixelY,
      pixelW,
      pixelH,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const base64Image = canvas.toDataURL('image/jpeg', 0.95);
    onComplete(base64Image, prompt);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex flex-col bg-slate-950 text-white select-none overflow-hidden"
    >
      {/* Custom Styles for Google Lens Viewfinder & Glowing ReactCrop Handles */}
      <style>{`
        .ReactCrop {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          max-height: 100% !important;
          max-width: 100% !important;
        }
        .ReactCrop__crop-selection {
          border: 2px solid rgba(34, 211, 238, 0.9) !important;
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.4), inset 0 0 15px rgba(34, 211, 238, 0.2) !important;
        }
        .ReactCrop__drag-handle {
          background-color: #38bdf8 !important;
          border: 2px solid #ffffff !important;
          width: 14px !important;
          height: 14px !important;
          border-radius: 9999px !important;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.9) !important;
        }
        .ReactCrop__drag-handle.ord-nw,
        .ReactCrop__drag-handle.ord-ne,
        .ReactCrop__drag-handle.ord-sw,
        .ReactCrop__drag-handle.ord-se {
          width: 16px !important;
          height: 16px !important;
          background-color: #ffffff !important;
          border: 3px solid #06b6d4 !important;
        }
      `}</style>

      {/* Top Header Bar - Optimized for mobile & desktop */}
      <div className="h-12 sm:h-14 px-2.5 sm:px-6 flex items-center justify-between border-b border-white/10 shrink-0 bg-slate-900/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.5)] shrink-0">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="text-white font-extrabold text-xs sm:text-base tracking-wide flex items-center gap-1 shrink-0">
                Magic Lens
              </h3>
              <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border flex items-center gap-1 transition-colors shrink-0 ${
                isDocDetected 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                  : isScanning
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {isDocDetected && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                {isScanning && <Scan className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />}
                <span className="hidden xs:inline max-w-[125px] sm:max-w-none truncate">{detectionStatus}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Top-Right Action Buttons: Full Photo, Auto Detect, Close */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Cover Full Photo Button */}
          <button 
            type="button"
            onClick={handleSelectFullPhoto}
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 text-slate-200 hover:text-white"
            title="Expand crop to cover full photo"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Full Photo</span>
          </button>

          {/* Re-trigger Auto-Detect */}
          <button 
            type="button"
            onClick={handleRedetect}
            disabled={isScanning}
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 bg-blue-600/30 hover:bg-blue-600/50 active:scale-95 border border-blue-400/40 text-blue-200 hover:text-white disabled:opacity-50"
            title="Re-run Google Lens document detection"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-300 ${isScanning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Auto Detect</span>
          </button>

          {/* Close Button */}
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
            title="Close Magic Lens"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Big Cropping Area - Expands up to the bottom UI controls with perfect breathing room */}
      <div 
        ref={containerRef}
        className="flex-1 w-full min-h-0 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden bg-slate-950/80"
      >
        <div 
          className="relative max-h-full max-w-full flex items-center justify-center overflow-hidden cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          title="Click or tap any area to shrink bounding box"
        >
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => {
              // Prevent accidental empty crops on quick taps before auto-shrink executes
              if (percentCrop.width < 3 || percentCrop.height < 3) return;
              setCrop(percentCrop);
            }}
            onComplete={(c, percentCrop) => {
              if (percentCrop && (percentCrop.width >= 3 || percentCrop.height >= 3)) {
                setCompletedCrop(percentCrop);
              } else if (c && (c.width >= 3 || c.height >= 3)) {
                setCompletedCrop(c);
              }
            }}
            className="relative rounded-xl overflow-hidden"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              onLoad={onImageLoad}
              className="max-h-[calc(100dvh-170px)] sm:max-h-[calc(100dvh-185px)] max-w-[96vw] sm:max-w-[92vw] w-auto h-auto object-contain block rounded-xl shadow-2xl select-none pointer-events-none"
              alt="Magic Lens Captured Document"
            />
          </ReactCrop>

          {/* Glowing Animated Tap Reticle Pulse at Click Coordinates */}
          <AnimatePresence>
            {tapIndicator && (
              <motion.div
                key={tapIndicator.id}
                initial={{ opacity: 1, scale: 0.3 }}
                animate={{ opacity: [1, 0.85, 0], scale: [0.3, 1.3, 1.7] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: "easeOut" }}
                style={{
                  position: 'absolute',
                  left: `${tapIndicator.x}%`,
                  top: `${tapIndicator.y}%`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none'
                }}
                className="z-40 flex items-center justify-center pointer-events-none"
              >
                <div className="w-12 h-12 rounded-full border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.95)] bg-cyan-400/25 flex items-center justify-center">
                  <Target className="w-5 h-5 text-cyan-200 stroke-[2.5]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google Lens Laser Scanner Sweep Beam */}
          <AnimatePresence>
            {isScanning && (
              <motion.div
                initial={{ top: '0%' }}
                animate={{ top: ['0%', '98%', '0%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_rgba(34,211,238,0.95)] pointer-events-none z-30"
              >
                <div className="absolute inset-0 bg-cyan-300 blur-[2px]" />
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-cyan-500/80 text-[9px] font-black text-white tracking-widest uppercase backdrop-blur-sm">
                  Scanning
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google Lens Glowing Corner Reticles anchored to the crop box */}
          {crop && crop.width > 0 && crop.height > 0 && (
            <div 
              style={{
                position: 'absolute',
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.width}%`,
                height: `${crop.height}%`,
                pointerEvents: 'none'
              }}
              className="z-25 transition-all duration-75"
            >
              {/* Top-Left Corner */}
              <div className="absolute -top-1.5 -left-1.5 w-5 h-5 sm:w-6 sm:h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
              {/* Top-Right Corner */}
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
              {/* Bottom-Left Corner */}
              <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 sm:w-6 sm:h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
              {/* Bottom-Right Corner */}
              <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom UI Elements Area - Placed cleanly below cropping area without overlapping */}
      <div className="shrink-0 w-full bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-2.5 sm:px-6 py-2 sm:py-3 z-20 flex flex-col gap-1.5 sm:gap-2 shadow-2xl">
        {/* Quick Suggestion Chips with Tap-to-Crop Guidance */}
        <div className="flex items-center justify-between gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
              <Wand2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400" />
              <span className="hidden xs:inline">Prompts:</span>
            </span>
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(qp.replace(/^[^\w]+/, ''))}
                className="shrink-0 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-95 text-[10px] sm:text-[11px]"
              >
                {qp}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-1 text-[11px] font-medium text-cyan-300/80 bg-cyan-950/60 border border-cyan-500/25 px-2.5 py-0.5 rounded-full shrink-0">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Click any question to shrink crop</span>
          </div>
        </div>

        {/* Input & Action Row */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <input 
            type="text" 
            placeholder="Ask anything about this document or problem..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
              }
            }}
            className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/80 bg-slate-950/80 border-slate-700/80 text-white placeholder:text-slate-500 shadow-inner"
          />

          <button 
            type="button"
            onClick={handleConfirm}
            className="px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 sm:gap-2 transition-all shadow-[0_0_20px_rgba(59,130,246,0.5)] active:scale-95 shrink-0"
            title="Analyze Cropped Region (25 Credits)"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-300 animate-pulse" />
            <span className="hidden xs:inline">Analyze</span>
            <span className="text-[10px] sm:text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded-full text-white/90">
              25⚡
            </span>
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
