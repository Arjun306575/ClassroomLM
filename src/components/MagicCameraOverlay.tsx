import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Camera, Image as ImageIcon, ScanText, Sparkles, Send, ChevronLeft, Zap, ZapOff, Maximize2, RefreshCw, SwitchCamera } from "lucide-react";

interface MagicCameraOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (image: { base64: string; type: string; name: string }, prompt: string, controller: AbortController) => Promise<void>;
  isDarkMode: boolean;
}


function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn("Error reading localStorage", error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn("Error setting localStorage", error);
    }
  };

  return [storedValue, setValue] as const;
}

export default function MagicCameraOverlay({ isOpen, onClose, onCapture, isDarkMode }: MagicCameraOverlayProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [flashMode, setFlashMode] = useState<'flash-off' | 'flash-on' | 'flash-automatic'>('flash-automatic');
  const [isScreenFlashing, setIsScreenFlashing] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [isFocusLocked, setIsFocusLocked] = useState(false);

  const setHardwareTorch = useCallback(async (enabled: boolean) => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities = (track.getCapabilities?.() as any) || {};
      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: enabled } as any]
        });
      }
    } catch (e) {
      console.warn("Torch toggle:", e);
    }
  }, [stream]);

  const handleSelectFlashMode = useCallback(async (mode: 'flash-off' | 'flash-on' | 'flash-automatic') => {
    setFlashMode(mode);
    if (mode === 'flash-on') {
      await setHardwareTorch(true);
    } else {
      await setHardwareTorch(false);
    }
  }, [setHardwareTorch]);

  const [capturedImage, setCapturedImage] = useLocalStorage<string | null>("magicCameraImage", null);
  const [capturedImageName, setCapturedImageName] = useLocalStorage("magicCameraImageName", "");
  const [crop, setCrop] = useLocalStorage("magicCameraCrop", { x: 15, y: 15, w: 70, h: 70 });
  const [promptText, setPromptText] = useLocalStorage("magicCameraPrompt", "");
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scanAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setStream(null);
      setCapturedImage(null);
      setCapturedImageName("");
      setPromptText("");
      setIsScanning(false);
      setCrop({ x: 15, y: 15, w: 70, h: 70 });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]); // stream left out to avoid stopping on updates

  // Pointer drag logic for crop handles
  useEffect(() => {
    if (!isDragging) return;
    
    const onPointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - startPos.x) / width) * 100;
      const dy = ((e.clientY - startPos.y) / height) * 100;

      const newCrop = { ...startCrop };
      
      if (isDragging === "center") {
        newCrop.x = Math.max(0, Math.min(100 - newCrop.w, startCrop.x + dx));
        newCrop.y = Math.max(0, Math.min(100 - newCrop.h, startCrop.y + dy));
      } else {
        if (isDragging.includes("l")) {
          newCrop.x = Math.max(0, Math.min(startCrop.x + startCrop.w - 10, startCrop.x + dx));
          newCrop.w = startCrop.w + (startCrop.x - newCrop.x);
        }
        if (isDragging.includes("r")) {
          newCrop.w = Math.max(10, Math.min(100 - startCrop.x, startCrop.w + dx));
        }
        if (isDragging.includes("t")) {
          newCrop.y = Math.max(0, Math.min(startCrop.y + startCrop.h - 10, startCrop.y + dy));
          newCrop.h = startCrop.h + (startCrop.y - newCrop.y);
        }
        if (isDragging.includes("b")) {
          newCrop.h = Math.max(10, Math.min(100 - startCrop.y, startCrop.h + dy));
        }
      }
      setCrop(newCrop);
    };
    
    const onPointerUp = () => setIsDragging(null);
        
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
        
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isDragging, startPos, startCrop]);

  const handlePointerDown = (e: React.PointerEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(handle);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartCrop(crop);
  };

  const startCamera = async (targetFacing: 'environment' | 'user' = cameraFacing) => {
    try {
      setCameraError("");
      let mediaStream: MediaStream | null = null;

      // 1. Try to find rear / back camera device via deviceId
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (targetFacing === 'environment') {
          const rearCam = videoDevices.find(d => 
            /back|rear|environment|camera2 0|facing back/i.test(d.label)
          );
          if (rearCam) {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: rearCam.deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              }
            });
          }
        }
      } catch (e) {}

      // 2. Strict facingMode: { exact: targetFacing }
      if (!mediaStream) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: { exact: targetFacing },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 }
            } 
          });
        } catch (e) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: targetFacing },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 }
            }
          });
        }
      }
      
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = (track.getCapabilities?.() as any) || {};
      if (capabilities.focusMode?.includes('continuous')) {
        try {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
        } catch (err) {}
      }
      setStream(mediaStream);
    } catch (err) {
      setCameraError("Camera access denied or unavailable.");
    }
  };

  const toggleCameraFacing = async () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    await startCamera(nextFacing);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Simultaneous Autofocus Reticle Trigger
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      setFocusPoint({ x: centerX, y: centerY });
      setIsFocusLocked(false);

      if (stream) {
        const track = stream.getVideoTracks()[0];
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
          } catch (err) {}
        }
      }

      const shouldFlash = flashMode === 'flash-on' || flashMode === 'flash-automatic';
      if (shouldFlash) {
        setIsScreenFlashing(true);
        await setHardwareTorch(true);
      }

      setTimeout(() => setIsFocusLocked(true), 150);
      await new Promise(res => setTimeout(res, 150));

      // Crop the raw video feed to match the CSS object-cover display exactly
      const videoRect = video.getBoundingClientRect();
      const displayAspect = videoRect.width / videoRect.height;
      const intrinsicAspect = video.videoWidth / video.videoHeight;
      
      let sx = 0, sy = 0, sWidth = video.videoWidth, sHeight = video.videoHeight;
      
      if (displayAspect > intrinsicAspect) {
        sHeight = video.videoWidth / displayAspect;
        sy = (video.videoHeight - sHeight) / 2;
      } else {
        sWidth = video.videoHeight * displayAspect;
        sx = (video.videoWidth - sWidth) / 2;
      }
      
      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        if (flashMode === 'flash-automatic') {
          await setHardwareTorch(false);
        }
        setIsScreenFlashing(false);
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        setCapturedImage(dataUrl);
        setCapturedImageName("camera-capture.jpg");
        // Start crop bounded cleanly covering full photo
        setCrop({ x: 2, y: 2, w: 96, h: 96 });
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setCapturedImage(reader.result);
          setCapturedImageName(file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const generateCroppedImage = async (): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(capturedImage!);
        
        let scaleX = 1;
        let scaleY = 1;
        
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          scaleX = img.naturalWidth / rect.width;
          scaleY = img.naturalHeight / rect.height;
        }

        const sx = (crop.x / 100) * img.naturalWidth;
        const sy = (crop.y / 100) * img.naturalHeight;
        const sWidth = (crop.w / 100) * img.naturalWidth;
        const sHeight = (crop.h / 100) * img.naturalHeight;

        canvas.width = sWidth;
        canvas.height = sHeight;
        
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = capturedImage!;
    });
  };

  const handleSubmit = async () => {
    setIsScanning(true);
    const croppedDataUrl = await generateCroppedImage();
    
    scanAbortControllerRef.current = new AbortController();
    try {
      await onCapture(
        { base64: croppedDataUrl, type: "image/jpeg", name: capturedImageName },
        promptText.trim(),
        scanAbortControllerRef.current
      );
      onClose();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Capture error:", err);
      }
    } finally {
      setIsScanning(false);
      scanAbortControllerRef.current = null;
    }
  };

  const cancelScan = () => {
    if (scanAbortControllerRef.current) {
      scanAbortControllerRef.current.abort();
    }
    setIsScanning(false);
    setCapturedImage(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
        <style>{`
          @keyframes border-wave {
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }
          .liquid-wave-box {
            border-radius: 12px;
            container-type: size;
          }
          .liquid-wave-border {
            border-radius: 12px;
            padding: 3px;
            background: linear-gradient(90deg, #38BDF8, #FDE047, #818CF8, #2DD4BF, #38BDF8);
            background-size: 200% auto;
            animation: border-wave 2s linear infinite;
            will-change: background-position;
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.3);
            pointer-events: none;
          }
        `}</style>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl max-h-full p-1 rounded-[2.2rem] flex flex-col rainbow-glow"
        >
          <div className="relative w-full h-full flex flex-col rounded-[2rem] overflow-hidden bg-slate-950/95 backdrop-blur-2xl shadow-inner min-h-[60vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent text-white shrink-0 absolute top-0 inset-x-0 z-50 pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                {capturedImage && (
                  <button onClick={() => {
                    if (isScanning) {
                      cancelScan();
                    } else {
                      setCapturedImage(null);
                    }
                  }} className="p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors backdrop-blur-md border border-white/20">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/20">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold tracking-wide font-display text-sm">Magic Lens</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pointer-events-auto">
                {/* Flashlight Mode Switcher (flash-off, flash-on, flash-automatic) */}
                {!capturedImage && stream && (
                  <div className="flex items-center bg-black/60 backdrop-blur-md rounded-full border border-white/20 p-1 shadow-lg">
                    <button 
                      type="button"
                      onClick={() => handleSelectFlashMode('flash-off')}
                      className={`px-2 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                        flashMode === 'flash-off' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Flash Off"
                    >
                      <ZapOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Off</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleSelectFlashMode('flash-on')}
                      className={`px-2 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                        flashMode === 'flash-on' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-amber-300'
                      }`}
                      title="Flash On (Torch ON)"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span className="hidden sm:inline">On</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleSelectFlashMode('flash-automatic')}
                      className={`px-2 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                        flashMode === 'flash-automatic' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-cyan-300'
                      }`}
                      title="Flash Automatic"
                    >
                      <div className="relative flex items-center">
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span className="text-[8px] font-black ml-0.5">A</span>
                      </div>
                      <span className="hidden sm:inline">Auto</span>
                    </button>
                  </div>
                )}

                {/* Switch Camera Button (Back / Front) */}
                {!capturedImage && stream && (
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors backdrop-blur-md border border-white/20 text-cyan-400"
                    title={`Switch Camera (Currently: ${cameraFacing === 'environment' ? 'Back' : 'Front'})`}
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                )}

                {capturedImage && (
                  <button
                    type="button"
                    onClick={() => setCrop({ x: 0, y: 0, w: 100, h: 100 })}
                    className="px-2.5 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-slate-200 flex items-center gap-1"
                    title="Full Photo"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">Full Photo</span>
                  </button>
                )}

                <button onClick={() => {
                  if (isScanning) cancelScan();
                  onClose();
                }} className="p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors backdrop-blur-md border border-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="relative w-full flex-1 flex flex-col bg-black overflow-hidden">
              {!capturedImage ? (
                // Camera / Upload Mode
                <>
                  {stream ? (
                    <div 
                      className="relative w-full h-full cursor-crosshair overflow-hidden"
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button')) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX;
                        const y = e.clientY;
                        setFocusPoint({ x, y });
                        setIsFocusLocked(false);
                        if (stream) {
                          const track = stream.getVideoTracks()[0];
                          if (track) {
                            const capabilities = (track.getCapabilities?.() as any) || {};
                            const normX = Math.max(0.05, Math.min(0.95, (x - rect.left) / rect.width));
                            const normY = Math.max(0.05, Math.min(0.95, (y - rect.top) / rect.height));
                            track.applyConstraints({
                              advanced: [{
                                ...(capabilities.focusMode ? { focusMode: 'single-shot' } : {}),
                                ...(capabilities.pointsOfInterest ? { pointsOfInterest: [{ x: normX, y: normY }] } : {}),
                                exposureMode: 'continuous',
                                whiteBalanceMode: 'continuous'
                              } as any]
                            }).catch(() => {});
                          }
                        }
                        setTimeout(() => setIsFocusLocked(true), 160);
                        setTimeout(() => setFocusPoint(null), 1600);
                      }}
                    >
                      <video 
                        ref={(node) => {
                          if (node && stream) {
                            node.srcObject = stream;
                          }
                          videoRef.current = node;
                        }} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover pointer-events-none"
                        style={{
                          filter: isFocusLocked ? 'contrast(1.22) saturate(1.25) brightness(1.03)' : 'contrast(1.12) saturate(1.18)'
                        }}
                      />
                      
                      {/* Reticle */}
                      {focusPoint && (
                        <div 
                          className="absolute pointer-events-none z-30 -translate-x-1/2 -translate-y-1/2"
                          style={{ left: focusPoint.x, top: focusPoint.y }}
                        >
                          <div className={`w-16 h-16 border-2 rounded-xl flex items-center justify-center transition-all ${
                            isFocusLocked 
                              ? 'border-emerald-400 shadow-[0_0_20px_#34d399] bg-emerald-400/10' 
                              : 'border-cyan-400 shadow-[0_0_15px_#22d3ee] animate-pulse'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${isFocusLocked ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
                            {isFocusLocked && (
                              <div className="absolute -bottom-6 text-[9px] font-black text-emerald-300 bg-slate-950/90 px-2 py-0.5 rounded-full border border-emerald-500/40 uppercase whitespace-nowrap">
                                HDR Focused
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-8 inset-x-0 flex justify-center z-20">
                        <button 
                          onClick={capturePhoto}
                          className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/20 backdrop-blur hover:bg-white/40 transition-colors"
                        >
                          <div className="w-12 h-12 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
                      <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.4)]">
                        <ScanText className="w-12 h-12 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2 font-display">Scan Homework</h3>
                        <p className="text-slate-400 text-sm max-w-xs mx-auto">
                          Take a photo of your assignment or upload an image to get instant step-by-step help.
                        </p>
                      </div>
                      
                      {cameraError && (
                        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-left">
                          <h4 className="text-red-400 font-bold mb-1">Camera Access Needed</h4>
                          <p className="text-slate-300 text-sm mb-3">
                            Please allow camera access in your browser settings to use the Magic Lens.
                          </p>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => startCamera()}
                              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-bold transition-colors"
                            >
                              Retry Camera
                            </button>
                            <button 
                              onClick={() => {
                                setCameraError("");
                                fileInputRef.current?.click();
                              }}
                              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold transition-colors"
                            >
                              Upload Instead
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col w-full max-w-xs gap-3 mt-4">
                        <button 
                          onClick={() => startCamera()}
                          className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20"
                        >
                          <Camera className="w-5 h-5" />
                          Open Camera
                        </button>
                        
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all border border-white/10"
                        >
                          <ImageIcon className="w-5 h-5" />
                          Upload Photo
                        </button>
                        <input 
                          type="file" 
                          accept="image/*" 
                          ref={fileInputRef} 
                          className="hidden" 
                          onChange={handleFileUpload} 
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Crop & Review Mode
                <div className="flex-1 flex flex-col items-center justify-center w-full h-full relative overflow-hidden">
                  <div className="absolute inset-0 p-4 pt-20 pb-24 flex items-center justify-center" style={{ minHeight: 0, minWidth: 0 }}>
                    <div className="relative flex max-w-full max-h-full" style={{ minHeight: 0, minWidth: 0 }}>
                      <img 
                        src={capturedImage} 
                        alt="Captured" 
                        className="block select-none rounded-lg pointer-events-none"
                        draggable={false}
                        style={{ maxWidth: '100%', maxHeight: '100%', minWidth: 0, minHeight: 0, objectFit: 'scale-down' }}
                      />
                      
                      <div 
                        ref={containerRef}
                        className="absolute inset-0 cursor-crosshair rounded-lg overflow-hidden touch-none"
                      >
                        {/* Active Crop Box with Lens Style */}
                        <div 
                          className="absolute cursor-move liquid-wave-box touch-none"
                          style={{
                            top: `${crop.y}%`, left: `${crop.x}%`, width: `${crop.w}%`, height: `${crop.h}%`,
                            transform: 'translate3d(0,0,0)',
                            willChange: 'top, left, width, height',
                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)'
                          }}
                          onPointerDown={(e) => handlePointerDown(e, "center")}
                        >
                          <div className="absolute inset-0 liquid-wave-border pointer-events-none" />
                          
                          {/* Corner Handle Hitboxes */}
                          <div 
                            className="absolute -top-6 -left-6 w-12 h-12 cursor-nwse-resize z-10 touch-none" 
                            onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, "tl"); }} 
                          />
                          <div 
                            className="absolute -top-6 -right-6 w-12 h-12 cursor-nesw-resize z-10 touch-none" 
                            onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, "tr"); }} 
                          />
                          <div 
                            className="absolute -bottom-6 -left-6 w-12 h-12 cursor-nesw-resize z-10 touch-none" 
                            onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, "bl"); }} 
                          />
                          <div 
                            className="absolute -bottom-6 -right-6 w-12 h-12 cursor-nwse-resize z-10 touch-none" 
                            onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, "br"); }} 
                          />

                          {/* Dynamic Corner Handle Visuals */}
                          <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-0 left-0 border-white drop-shadow-md rounded-tl-[10px]" style={{ width: 'min(24px, 35cqw)', height: 'min(24px, 35cqh)', borderTopWidth: 'clamp(2px, 10cqw, 4px)', borderLeftWidth: 'clamp(2px, 10cqw, 4px)' }} />
                            <div className="absolute top-0 right-0 border-white drop-shadow-md rounded-tr-[10px]" style={{ width: 'min(24px, 35cqw)', height: 'min(24px, 35cqh)', borderTopWidth: 'clamp(2px, 10cqw, 4px)', borderRightWidth: 'clamp(2px, 10cqw, 4px)' }} />
                            <div className="absolute bottom-0 left-0 border-white drop-shadow-md rounded-bl-[10px]" style={{ width: 'min(24px, 35cqw)', height: 'min(24px, 35cqh)', borderBottomWidth: 'clamp(2px, 10cqw, 4px)', borderLeftWidth: 'clamp(2px, 10cqw, 4px)' }} />
                            <div className="absolute bottom-0 right-0 border-white drop-shadow-md rounded-br-[10px]" style={{ width: 'min(24px, 35cqw)', height: 'min(24px, 35cqh)', borderBottomWidth: 'clamp(2px, 10cqw, 4px)', borderRightWidth: 'clamp(2px, 10cqw, 4px)' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Input Area */}
                  <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
                    <div className="flex gap-2 max-w-lg mx-auto">
                      <input 
                        type="text" 
                        placeholder="Ask about this image..." 
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        className="flex-1 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 backdrop-blur-md"
                      />
                      <button 
                        onClick={handleSubmit}
                        className="px-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl transition-colors shrink-0 flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                      >
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Ask</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Scanning Overlay State */}
              {isScanning && (
                <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center pt-16">
                  <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-slate-700/50 rounded-3xl" />
                    <div className="absolute inset-0 border-4 border-transparent border-t-cyan-400 rounded-3xl animate-spin" style={{ animationDuration: '1.5s' }} />
                    <Sparkles className="w-10 h-10 text-cyan-400 animate-pulse" />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-2 font-display">Analyzing Image</h3>
                  <p className="text-slate-400 text-sm animate-pulse">Extracting homework problem details...</p>
                </div>
              )}
            </div>
            
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
