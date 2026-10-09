import React, { useRef, useState, useEffect } from "react";
import { 
  Type, 
  Paintbrush, 
  Trash2, 
  Undo2, 
  RotateCcw, 
  Save, 
  X, 
  Check, 
  Move,
  Sparkles,
  Eraser,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Settings2
} from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface DrawingLine {
  points: Point[];
  color: string;
  width: number;
  isHighlighter: boolean;
}

interface TextAnnotation {
  id: string;
  text: string;
  x: number; // relative percentage (0-100) for responsive drag & drop
  y: number; // relative percentage (0-100)
  color: string;
  fontSize: number;
}

interface ImageAnnotatorProps {
  imageUrl: string;
  isDarkMode: boolean;
  onSave: (annotatedDataUrl: string) => void;
  onClose: () => void;
}

export default function ImageAnnotator({ imageUrl, isDarkMode, onSave, onClose }: ImageAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tool states
  const [tool, setTool] = useState<"draw" | "highlight" | "eraser" | "text">("draw");
  const [color, setColor] = useState<string>("#e11d48"); // default rose-600
  const [brushSize, setBrushSize] = useState<number>(4);
  const [highlightSize, setHighlightSize] = useState<number>(18);
  const [fontSize, setFontSize] = useState<number>(16);

  // Annotations
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const [texts, setTexts] = useState<TextAnnotation[]>([]);
  const [activeLine, setActiveLine] = useState<Point[] | null>(null);

  // Undo history stacks
  const [history, setHistory] = useState<{ lines: DrawingLine[]; texts: TextAnnotation[] }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Text tools
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textInputValue, setTextInputValue] = useState("");
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Toolbar hide/show state
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  // Zoom and Popover States
  const [zoom, setZoom] = useState<number>(1.0);
  const [isSettingsPopoverOpen, setIsSettingsPopoverOpen] = useState(false);

  // Display size trackers
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  const colors = [
    { name: "Rose", value: "#e11d48" },
    { name: "Emerald", value: "#10b981" },
    { name: "Yellow", value: "#eab308" },
    { name: "Blue", value: "#2563eb" },
    { name: "Orange", value: "#f97316" },
    { name: "Purple", value: "#8b5cf6" },
    { name: "White", value: "#ffffff" },
    { name: "Black", value: "#0f172a" },
  ];

  // Sync canvas size on image load & window resize
  const updateCanvasSize = () => {
    if (imageRef.current && canvasRef.current) {
      const width = imageRef.current.offsetWidth || imageRef.current.clientWidth || 800;
      const height = imageRef.current.offsetHeight || imageRef.current.clientHeight || 600;
      setDisplaySize({ width, height });
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      drawCanvasStrokes();
    }
  };

  useEffect(() => {
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [lines]);

  useEffect(() => {
    // Re-evaluate canvas overlay size when the toolbar changes visibility or zoom factors change
    const timer = setTimeout(() => {
      updateCanvasSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [isToolbarVisible, zoom]);

  // Save state to undo history
  const saveToHistory = (newLines = lines, newTexts = texts) => {
    setHistory(prev => [...prev, { lines: [...lines], texts: [...texts] }]);
  };

  // Re-draw drawing strokes onto transparent canvas overlay
  const drawCanvasStrokes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all completed lines
    lines.forEach(line => {
      if (line.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (line.isHighlighter) {
        ctx.globalAlpha = 0.45;
      } else {
        ctx.globalAlpha = 1.0;
      }

      ctx.moveTo(line.points[0].x, line.points[0].y);
      for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x, line.points[i].y);
      }
      ctx.stroke();
    });

    // Draw active line currently drawing
    if (activeLine && activeLine.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = tool === "highlight" ? highlightSize : brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = tool === "highlight" ? 0.45 : 1.0;

      ctx.moveTo(activeLine[0].x, activeLine[0].y);
      for (let i = 1; i < activeLine.length; i++) {
        ctx.lineTo(activeLine[i].x, activeLine[i].y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0; // reset
  };

  // Keep drawing in sync when lines or active line change
  useEffect(() => {
    drawCanvasStrokes();
  }, [lines, activeLine, displaySize]);

  // Handle drawing events
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (tool === "text") {
      const coords = getCoordinates(e);
      if (coords) {
        // Create text annotation
        const relX = (coords.x / displaySize.width) * 100;
        const relY = (coords.y / displaySize.height) * 100;
        const newId = `txt-${Date.now()}`;
        
        saveToHistory();
        const newText: TextAnnotation = {
          id: newId,
          text: "Double-click to type",
          x: relX,
          y: relY,
          color: color === "#0f172a" && isDarkMode ? "#ffffff" : color,
          fontSize: fontSize
        };
        setTexts(prev => [...prev, newText]);
        setEditingTextId(newId);
        setTextInputValue("");
      }
      return;
    }

    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    saveToHistory();

    if (tool === "eraser") {
      // Find and erase lines near coordinates
      eraseAt(coords);
    } else {
      setActiveLine([coords]);
    }
  };

  const handleDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    if (tool === "eraser") {
      eraseAt(coords);
    } else if (activeLine) {
      setActiveLine(prev => prev ? [...prev, coords] : [coords]);
    }
  };

  const handleEndDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeLine && activeLine.length > 0) {
      const newLine: DrawingLine = {
        points: activeLine,
        color: color,
        width: tool === "highlight" ? highlightSize : brushSize,
        isHighlighter: tool === "highlight"
      };
      setLines(prev => [...prev, newLine]);
      setActiveLine(null);
    }
  };

  const eraseAt = (pt: Point) => {
    const threshold = 15; // erase radius
    setLines(prev => prev.filter(line => {
      // Keep line if all points are far enough from Pt
      const closePoint = line.points.some(p => {
        const dist = Math.sqrt(Math.pow(p.x - pt.x, 2) + Math.pow(p.y - pt.y, 2));
        return dist < threshold;
      });
      return !closePoint;
    }));
  };

  // Undo last action
  const handleUndo = () => {
    if (history.length === 0) return;
    const prevAction = history[history.length - 1];
    setLines(prevAction.lines);
    setTexts(prevAction.texts);
    setHistory(prev => prev.slice(0, -1));
  };

  // Reset entire drawing board
  const handleReset = () => {
    if (lines.length === 0 && texts.length === 0) return;
    saveToHistory();
    setLines([]);
    setTexts([]);
    setEditingTextId(null);
  };

  // Text interaction
  const handleTextStartDrag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDraggingTextId(id);
    const textObj = texts.find(t => t.id === id);
    if (!textObj || !containerRef.current) return;

    const absX = (textObj.x / 100) * displaySize.width;
    const absY = (textObj.y / 100) * displaySize.height;

    setDragOffset({
      x: e.clientX - absX,
      y: e.clientY - absY,
    });
  };

  const handleTextDrag = (e: React.MouseEvent) => {
    if (!draggingTextId || !displaySize.width || !displaySize.height) return;
    const textObj = texts.find(t => t.id === draggingTextId);
    if (!textObj) return;

    const newAbsX = e.clientX - dragOffset.x;
    const newAbsY = e.clientY - dragOffset.y;

    // Convert back to percentages (capped 0-100)
    const relX = Math.max(0, Math.min(100, (newAbsX / displaySize.width) * 100));
    const relY = Math.max(0, Math.min(100, (newAbsY / displaySize.height) * 100));

    setTexts(prev => prev.map(t => t.id === draggingTextId ? { ...t, x: relX, y: relY } : t));
  };

  const handleTextEndDrag = () => {
    if (draggingTextId) {
      saveToHistory();
      setDraggingTextId(null);
    }
  };

  const handleSaveTextEdit = (id: string) => {
    saveToHistory();
    setTexts(prev => prev.map(t => t.id === id ? { ...t, text: textInputValue.trim() || "Double-click to type" } : t));
    setEditingTextId(null);
  };

  const handleDeleteText = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    saveToHistory();
    setTexts(prev => prev.filter(t => t.id !== id));
    if (editingTextId === id) setEditingTextId(null);
  };

  // Flatten image + drawing layers into a single high-quality exported data URL
  const handleExport = () => {
    if (!imageRef.current) return;

    const originalImg = imageRef.current;
    const naturalW = originalImg.naturalWidth;
    const naturalH = originalImg.naturalHeight;

    if (!naturalW || !naturalH) return;

    // Create a physical high-res canvas matching original image dimensions
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = naturalW;
    exportCanvas.height = naturalH;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    // 1. Draw the base image
    ctx.drawImage(originalImg, 0, 0, naturalW, naturalH);

    // Calculate scale multiplier
    const scaleX = naturalW / displaySize.width;
    const scaleY = naturalH / displaySize.height;

    // 2. Render all lines scaled
    lines.forEach(line => {
      if (line.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      // Scale line width proportionally
      ctx.lineWidth = line.width * scaleX;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (line.isHighlighter) {
        ctx.globalAlpha = 0.45;
      } else {
        ctx.globalAlpha = 1.0;
      }

      ctx.moveTo(line.points[0].x * scaleX, line.points[0].y * scaleY);
      for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x * scaleX, line.points[i].y * scaleY);
      }
      ctx.stroke();
    });

    ctx.globalAlpha = 1.0; // reset

    // 3. Render all text annotations scaled
    texts.forEach(t => {
      const absX = (t.x / 100) * naturalW;
      const absY = (t.y / 100) * naturalH;
      const fontSizePx = t.fontSize * scaleX;

      ctx.font = `bold ${fontSizePx}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Simple drop shadow for maximum legibility on any image background
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 4 * scaleX;
      ctx.shadowOffsetX = 1.5 * scaleX;
      ctx.shadowOffsetY = 1.5 * scaleX;

      ctx.fillText(t.text, absX, absY);

      // Reset shadows
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    });

    // 4. Export as premium quality jpeg
    const dataUrl = exportCanvas.toDataURL("image/jpeg", 0.95);
    onSave(dataUrl);
  };

  return (
    <div 
      className="flex flex-col md:flex-row w-full h-[85vh] rounded-3xl overflow-hidden"
      onMouseMove={handleTextDrag}
      onMouseUp={handleTextEndDrag}
    >
      {/* LEFT PANEL: Interactive Canvas Work Area */}
      <div className={`flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden ${
        isDarkMode ? "bg-slate-950" : "bg-slate-100"
      }`}>
        {/* Dynamic Studio Annotation Badge */}
        <div className="absolute top-4 left-6 flex items-center gap-2 z-10">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            Diagram Studio Editor Layer
          </span>
        </div>

        {/* Hide/Show Annotation Tools Button */}
        <button
          onClick={() => setIsToolbarVisible(!isToolbarVisible)}
          className={`absolute top-4 right-6 z-30 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-lg cursor-pointer border hover:scale-[1.02] active:scale-95 ${
            isDarkMode 
              ? "bg-slate-900 border-white/10 hover:bg-slate-800 text-slate-200" 
              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
          }`}
          title={isToolbarVisible ? "Hide annotation toolbar" : "Show annotation toolbar"}
        >
          {isToolbarVisible ? (
            <>
              <EyeOff className="w-4 h-4 text-rose-500" />
              <span>Hide Tools</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-emerald-500" />
              <span>Show Tools</span>
            </>
          )}
        </button>

        {/* Scrollable container for zoomed canvas */}
        <div className="w-full h-full max-h-[65vh] overflow-auto flex items-center justify-center p-2 relative">
          {/* Canvas Workspace Container */}
          <div 
            ref={containerRef}
            style={displaySize.width > 0 ? {
              width: `${displaySize.width * zoom}px`,
              height: `${displaySize.height * zoom}px`,
              position: "relative",
              flexShrink: 0,
              transition: "width 0.1s ease-out, height 0.1s ease-out",
            } : undefined}
            className={`relative flex items-center justify-center select-none ${
              zoom > 1.0 ? "" : "max-w-full max-h-[60vh]"
            }`}
          >
            {/* Base study image */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Source diagram"
              onLoad={updateCanvasSize}
              referrerPolicy="no-referrer"
              style={{
                width: "100%",
                height: "100%",
              }}
              className="object-contain rounded-2xl border shadow-xl bg-slate-900 border-white/10 pointer-events-none"
            />

            {/* Transparent Canvas Drawing Overlay */}
            <canvas
              ref={canvasRef}
              onMouseDown={handleStartDraw}
              onMouseMove={handleDrawing}
              onMouseUp={handleEndDraw}
              onMouseLeave={handleEndDraw}
              onTouchStart={handleStartDraw}
              onTouchMove={handleDrawing}
              onTouchEnd={handleEndDraw}
              style={{
                width: "100%",
                height: "100%",
              }}
              className={`absolute inset-0 rounded-2xl touch-none ${
                tool === "text" ? "cursor-text" : tool === "eraser" ? "cursor-crosshair" : "cursor-pencil"
              }`}
            />

          {/* Render Text Annotations as Draggable HTML elements */}
          {texts.map(t => {
            const isEditing = editingTextId === t.id;
            return (
              <div
                key={t.id}
                style={{
                  position: "absolute",
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  transform: "translate(-50%, -50%)",
                  fontSize: `${t.fontSize}px`,
                  color: t.color,
                }}
                className={`absolute group z-20 font-bold px-2 py-1 rounded transition-shadow hover:bg-slate-800/80 hover:text-white select-none whitespace-nowrap flex items-center gap-2 cursor-move ${
                  isEditing ? "bg-slate-900 ring-2 ring-indigo-500 shadow-2xl" : ""
                }`}
                onMouseDown={(e) => handleTextStartDrag(e, t.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTextId(t.id);
                  setTextInputValue(t.text);
                }}
              >
                {isEditing ? (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveTextEdit(t.id);
                    }}
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      autoFocus
                      value={textInputValue}
                      onChange={(e) => setTextInputValue(e.target.value)}
                      className="bg-slate-950 text-white text-xs px-2 py-1 rounded border border-indigo-500 outline-none w-36 font-semibold"
                      placeholder="Enter label..."
                    />
                    <button 
                      type="submit"
                      className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button 
                      type="button" 
                      onClick={(e) => handleDeleteText(e, t.id)}
                      className="p-1 bg-rose-600 hover:bg-rose-500 text-white rounded cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </form>
                ) : (
                  <>
                    <span 
                      style={{
                        textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 0 1px rgba(0,0,0,0.9)"
                      }}
                      className="drop-shadow-lg"
                    >
                      {t.text}
                    </span>
                    {/* Floating controls for hover */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-950/90 text-white text-[9px] px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-30 border border-slate-700 pointer-events-auto">
                      <Move className="w-2.5 h-2.5 text-slate-400" />
                      <span>Drag</span>
                      <span className="text-slate-500">|</span>
                      <button 
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTextId(t.id);
                          setTextInputValue(t.text);
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-bold"
                      >
                        Edit
                      </button>
                      <span className="text-slate-500">|</span>
                      <button 
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => handleDeleteText(e, t.id)}
                        className="text-rose-400 hover:text-rose-300"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          </div>
        </div>

        {/* Floating Zoom Controls Overlay */}
        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-full shadow-2xl border backdrop-blur-md transition-all ${
          isDarkMode 
            ? "bg-slate-900/90 border-white/10 text-slate-200" 
            : "bg-white/90 border-slate-200 text-slate-800"
        }`}>
          <button
            onClick={() => setZoom(prev => Math.max(0.5, Math.min(4, prev - 0.25)))}
            disabled={zoom <= 0.5}
            className="p-1 hover:bg-slate-500/20 rounded-full transition-colors disabled:opacity-30 cursor-pointer text-xs font-black flex items-center justify-center"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-20 sm:w-28 accent-emerald-500 cursor-pointer h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none"
          />

          <span className="text-[10px] font-mono font-bold w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={() => setZoom(prev => Math.max(0.5, Math.min(4, prev + 0.25)))}
            disabled={zoom >= 4}
            className="p-1 hover:bg-slate-500/20 rounded-full transition-colors disabled:opacity-30 cursor-pointer text-xs font-black flex items-center justify-center"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-800" />

          <button
            onClick={() => setZoom(1.0)}
            className="px-2 py-0.5 hover:bg-slate-500/20 rounded-md text-[10px] font-bold transition-colors cursor-pointer"
            title="Reset Zoom"
          >
            Reset
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Professional Toolbar Controls */}
      <div className={`w-full md:w-80 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l transition-all duration-300 ${
        isDarkMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
      } ${isToolbarVisible ? "" : "hidden"}`}>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4 border-slate-700/20">
            <div className="flex items-center gap-1.5 text-indigo-500">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <h2 className="text-sm font-black uppercase tracking-wider">Annotation Tools</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              title="Close annotation board"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Selector of Tools */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Tool Mode</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTool("draw")}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                  tool === "draw" 
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10 scale-[1.02]" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 border-transparent"
                }`}
              >
                <Paintbrush className="w-4 h-4 shrink-0" />
                <span>Draw / Pen</span>
              </button>

              <button
                onClick={() => setTool("highlight")}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                  tool === "highlight" 
                    ? "bg-yellow-500 text-slate-950 border-yellow-500 shadow-md shadow-yellow-500/10 scale-[1.02]" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 border-transparent"
                }`}
              >
                <span className="font-extrabold text-sm shrink-0">🎨</span>
                <span>Highlight</span>
              </button>

              <button
                onClick={() => setTool("text")}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                  tool === "text" 
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10 scale-[1.02]" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 border-transparent"
                }`}
              >
                <Type className="w-4 h-4 shrink-0" />
                <span>Add Text</span>
              </button>

              <button
                onClick={() => setTool("eraser")}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                  tool === "eraser" 
                    ? "bg-slate-700 text-white border-slate-700 shadow-md scale-[1.02]" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 border-transparent"
                }`}
              >
                <Eraser className="w-4 h-4 shrink-0" />
                <span>Erase Line</span>
              </button>
            </div>
          </div>

          {/* 2. Tool Settings Button with Popover */}
          {tool !== "eraser" && (
            <div className="relative">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Style & Size Settings</span>
              <button
                onClick={() => setIsSettingsPopoverOpen(!isSettingsPopoverOpen)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-between border transition-all cursor-pointer shadow-sm ${
                  isDarkMode 
                    ? "bg-slate-800 border-white/10 hover:bg-slate-750 text-slate-200" 
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border shadow-inner shrink-0" 
                    style={{ backgroundColor: color }}
                  />
                  <span>
                    {tool === "draw" && `Pen Size: ${brushSize}px`}
                    {tool === "highlight" && `Highlight: ${highlightSize}px`}
                    {tool === "text" && `Font Size: ${fontSize}px`}
                  </span>
                </div>
                <Settings2 className="w-4 h-4 text-slate-400" />
              </button>

              {/* Popover Menu */}
              {isSettingsPopoverOpen && (
                <>
                  {/* Overlay to close popover when clicking outside */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsSettingsPopoverOpen(false)}
                  />
                  <div className={`absolute right-0 left-0 md:left-auto md:w-72 mt-2 p-4 rounded-2xl border shadow-2xl z-50 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-150 ${
                    isDarkMode 
                      ? "bg-slate-950 border-slate-800 text-slate-200" 
                      : "bg-white border-slate-200 text-slate-800"
                  }`}>
                    {/* Color selection inside popover */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Brush & Accent Color</span>
                      <div className="grid grid-cols-4 gap-2">
                        {colors.map((c) => (
                          <button
                            key={c.value}
                            onClick={() => {
                              setColor(c.value);
                              if (tool === "text" && editingTextId) {
                                setTexts(prev => prev.map(t => t.id === editingTextId ? { ...t, color: c.value } : t));
                              }
                            }}
                            style={{ backgroundColor: c.value }}
                            className={`h-7 rounded-lg border relative transition-transform hover:scale-110 cursor-pointer shadow-sm ${
                              color === c.value 
                                ? "ring-2 ring-indigo-500 scale-105 border-white" 
                                : "border-slate-300 dark:border-slate-700"
                            }`}
                            title={c.name}
                          >
                            {color === c.value && (
                              <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow-md text-[10px]">
                                ✓
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sizing sliders inside popover */}
                    {tool === "draw" && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <span>Brush Width</span>
                          <span>{brushSize}px</span>
                        </div>
                        <input 
                          type="range"
                          min="1"
                          max="12"
                          value={brushSize}
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          className="w-full accent-indigo-600 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    )}

                    {tool === "highlight" && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <span>Highlight Width</span>
                          <span>{highlightSize}px</span>
                        </div>
                        <input 
                          type="range"
                          min="10"
                          max="40"
                          value={highlightSize}
                          onChange={(e) => setHighlightSize(parseInt(e.target.value))}
                          className="w-full accent-yellow-500 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    )}

                    {tool === "text" && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <span>Text Font Size</span>
                          <span>{fontSize}px</span>
                        </div>
                        <input 
                          type="range"
                          min="12"
                          max="32"
                          value={fontSize}
                          onChange={(e) => {
                            const size = parseInt(e.target.value);
                            setFontSize(size);
                            if (editingTextId) {
                              setTexts(prev => prev.map(t => t.id === editingTextId ? { ...t, fontSize: size } : t));
                            }
                          }}
                          className="w-full accent-emerald-600 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tips label */}
          <div className="text-[10px] text-slate-500 dark:text-slate-400 p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-700/10 leading-relaxed font-semibold">
            {tool === "draw" && "💡 Drag on the diagram to draw arrows, boxes or write annotations directly with freehand brush."}
            {tool === "highlight" && "💡 Use the translucent highlight brush to mark keys, titles or cellular parts on the diagram."}
            {tool === "text" && "💡 Click on the image to place a text label. Double-click any label to edit or reposition it by dragging."}
            {tool === "eraser" && "💡 Swipe over drawing strokes or highlight segments to quickly erase them."}
          </div>
        </div>

        {/* BOTTOM ACTIONS: History, Clear, Export */}
        <div className="flex flex-col gap-3.5 pt-4 border-t border-slate-700/20">
          <div className="flex gap-2">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                history.length > 0 
                  ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 active:scale-95" 
                  : "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800"
              }`}
              title="Undo last action"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            <button
              onClick={handleReset}
              disabled={lines.length === 0 && texts.length === 0}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                lines.length > 0 || texts.length > 0
                  ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 active:scale-95"
                  : "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800"
              }`}
              title="Reset all annotations"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          <button
            onClick={handleExport}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl hover:shadow-2xl cursor-pointer hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Apply & Flatten Diagram</span>
          </button>
        </div>
      </div>
    </div>
  );
}
