import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import { 
  X, 
  Sparkles, 
  Layers, 
  Image as ImageIcon, 
  Sliders, 
  Download, 
  Save, 
  CheckCircle2, 
  RefreshCw, 
  Crop, 
  Sun, 
  Contrast, 
  Eye, 
  ShieldCheck,
  Zap,
  Maximize2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { processProductImageInCanvas } from '../../lib/imageEnhancer';
import type { Product, ImageEnhancementOptions, EnhancedImageResult } from '../../types';

interface ImageStudioModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onImageUpdated?: (updatedProduct: Product) => void;
}

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  product,
  isOpen,
  onClose,
  onImageUpdated
}) => {
  const { enhanceProductImageAction, batchEnhanceAllImagesAction, showToast } = useApp();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '16:9'>('1:1');
  const [studioBackdrop, setStudioBackdrop] = useState<'dark_studio' | 'minimal_white' | 'warm_sand' | 'frosted_glass' | 'transparent'>('dark_studio');
  const [removeBackground, setRemoveBackground] = useState(true);
  const [studioLighting, setStudioLighting] = useState(true);
  const [brightness, setBrightness] = useState(5);
  const [contrast, setContrast] = useState(15);
  const [saturation, setSaturation] = useState(10);
  const [sharpness, setSharpness] = useState(30);
  const [vignette, setVignette] = useState(20);
  const [watermark, setWatermark] = useState<'none' | 'subtle' | 'victoriosa_badge'>('subtle');

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiAdvisorNotes, setAiAdvisorNotes] = useState<string>('');
  const [viewMode, setViewMode] = useState<'split' | 'enhanced' | 'original'>('split');

  const images = product.images || [];
  const currentImageUrl = images[selectedImageIndex] || '';

  // Render Live Canvas Preview
  useEffect(() => {
    if (!isOpen || !currentImageUrl) return;

    let isMounted = true;
    const renderPreview = async () => {
      setIsProcessing(true);
      try {
        const result = await processProductImageInCanvas(currentImageUrl, {
          aspectRatio,
          studioBackdrop,
          removeBackground,
          studioLighting,
          brightness,
          contrast,
          saturation,
          sharpness,
          vignette,
          watermark
        });
        if (isMounted) {
          setPreviewUrl(result.enhancedDataUrl);
        }
      } catch (err) {
        console.warn('Canvas preview error:', err);
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    };

    renderPreview();

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    currentImageUrl,
    aspectRatio,
    studioBackdrop,
    removeBackground,
    studioLighting,
    brightness,
    contrast,
    saturation,
    sharpness,
    vignette,
    watermark
  ]);

  if (!isOpen) return null;

  // AI Advisor Preset
  const handleConsultAiAdvisor = async () => {
    setIsProcessing(true);
    try {
      showToast('Gemini IA analizando iluminación y composición de la imagen...', 'info');
      const res = await apiFetch('/api/autopilot/enhance-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: currentImageUrl,
          options: { aspectRatio, studioBackdrop }
        })
      });
      const data = await res.json();
      if (data.success && data.enhancementPlan) {
        const plan = data.enhancementPlan;
        setBrightness(plan.colorCorrection.brightness || 8);
        setContrast(plan.colorCorrection.contrast || 18);
        setSaturation(plan.colorCorrection.saturation || 12);
        setSharpness(plan.colorCorrection.sharpness || 35);
        setVignette(plan.colorCorrection.vignette || 25);
        if (plan.aiNotes) setAiAdvisorNotes(plan.aiNotes);
        showToast('Parámetros de estudio calibrados automáticamente por Gemini IA.', 'success');
      }
    } catch (err: any) {
      console.warn('AI Advisor fallback:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyPresets = (preset: 'obsidian' | 'clean_white' | 'editorial' | 'vibrant') => {
    if (preset === 'obsidian') {
      setStudioBackdrop('dark_studio');
      setBrightness(5);
      setContrast(18);
      setSaturation(10);
      setSharpness(35);
      setVignette(25);
      setStudioLighting(true);
      setWatermark('subtle');
    } else if (preset === 'clean_white') {
      setStudioBackdrop('minimal_white');
      setBrightness(12);
      setContrast(12);
      setSaturation(8);
      setSharpness(25);
      setVignette(5);
      setStudioLighting(true);
      setWatermark('none');
    } else if (preset === 'editorial') {
      setStudioBackdrop('warm_sand');
      setBrightness(8);
      setContrast(22);
      setSaturation(15);
      setSharpness(40);
      setVignette(30);
      setStudioLighting(true);
      setWatermark('victoriosa_badge');
    } else if (preset === 'vibrant') {
      setStudioBackdrop('frosted_glass');
      setBrightness(10);
      setContrast(20);
      setSaturation(25);
      setSharpness(30);
      setVignette(15);
      setStudioLighting(true);
      setWatermark('subtle');
    }
  };

  const handleSaveToFirebase = async () => {
    setIsSaving(true);
    try {
      const result = await enhanceProductImageAction(product.id, selectedImageIndex, {
        aspectRatio,
        studioBackdrop,
        removeBackground,
        studioLighting,
        brightness,
        contrast,
        saturation,
        sharpness,
        vignette,
        watermark
      });

      if (result) {
        showToast('Imagen guardada y sincronizada en Cloud Firestore & Storage.', 'success');
        if (onImageUpdated) {
          const updatedProd = {
            ...product,
            images: product.images.map((img, idx) => idx === selectedImageIndex ? result.storageUrl : img)
          };
          onImageUpdated(updatedProd);
        }
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving enhanced image:', err);
      showToast(`Error al guardar imagen: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchEnhanceAll = async () => {
    setIsSaving(true);
    try {
      await batchEnhanceAllImagesAction(product.id, {
        aspectRatio,
        studioBackdrop,
        removeBackground,
        studioLighting,
        brightness,
        contrast,
        saturation,
        sharpness,
        vignette,
        watermark
      });
      onClose();
    } catch (err: any) {
      showToast(`Fallo en el procesado por lotes: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-5xl bg-[#0d111d]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-6 backdrop-blur-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-lg text-white">
                  Laboratorio de Retoque de Imagen Victoriosa
                </h2>
                <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold uppercase">
                  Firebase Storage & Canvas Pipeline
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Producto: <strong className="text-slate-200">{product.title.slice(0, 35)}...</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleConsultAiAdvisor}
              disabled={isProcessing}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Calibrar con Gemini IA</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left / Center: Interactive Preview (7 Cols) */}
          <div className="lg:col-span-7 p-6 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col justify-between bg-black/40 overflow-y-auto">
            
            {/* View Mode Toggle & Image Selector */}
            <div className="flex items-center justify-between gap-2 mb-4">
              {/* Image Selector Thumbnails */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                      selectedImageIndex === idx 
                        ? 'border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)] scale-105' 
                        : 'border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <span className="absolute bottom-0 right-0 bg-black/80 px-1 text-[9px] font-mono text-white">
                      #{idx + 1}
                    </span>
                  </button>
                ))}
              </div>

              {/* View Mode Pills */}
              <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 text-[11px]">
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    viewMode === 'split' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Comparar
                </button>
                <button
                  onClick={() => setViewMode('enhanced')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    viewMode === 'enhanced' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Retocada
                </button>
                <button
                  onClick={() => setViewMode('original')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    viewMode === 'original' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Original
                </button>
              </div>
            </div>

            {/* Main Stage Canvas Preview */}
            <div className="relative aspect-square w-full max-w-md mx-auto rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-[#080a10] flex items-center justify-center">
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono text-indigo-300">Renderizando retoque digital...</span>
                </div>
              )}

              {viewMode === 'split' ? (
                <div className="w-full h-full grid grid-cols-2">
                  <div className="relative border-r border-white/20 overflow-hidden bg-black/40">
                    <img
                      src={currentImageUrl}
                      alt="Original"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/70 text-slate-300 border border-white/10 backdrop-blur-sm">
                      Origen
                    </span>
                  </div>
                  <div className="relative overflow-hidden">
                    <img
                      src={previewUrl || currentImageUrl}
                      alt="Enhanced"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-600/80 text-white border border-indigo-400/40 backdrop-blur-sm font-bold">
                      Estudio Victoriosa
                    </span>
                  </div>
                </div>
              ) : viewMode === 'enhanced' ? (
                <img
                  src={previewUrl || currentImageUrl}
                  alt="Enhanced Full"
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={currentImageUrl}
                  alt="Original Full"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            {/* AI Advisor Feedback Note */}
            {aiAdvisorNotes && (
              <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-purple-300 font-mono text-[11px] block">Recomendación de Gemini Vision:</strong>
                  <p className="text-[11px] leading-relaxed">{aiAdvisorNotes}</p>
                </div>
              </div>
            )}

            {/* Quick Preset Buttons */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono mr-1">Presets de Lujo:</span>
              <button
                onClick={() => handleApplyPresets('obsidian')}
                className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-200 border border-white/10 transition-all font-mono hover:border-indigo-400/50"
              >
                Obsidian Dark (Lujo)
              </button>
              <button
                onClick={() => handleApplyPresets('clean_white')}
                className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-200 border border-white/10 transition-all font-mono hover:border-indigo-400/50"
              >
                Pure White Studio
              </button>
              <button
                onClick={() => handleApplyPresets('editorial')}
                className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-200 border border-white/10 transition-all font-mono hover:border-indigo-400/50"
              >
                Warm Sand & Gold
              </button>
              <button
                onClick={() => handleApplyPresets('vibrant')}
                className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-200 border border-white/10 transition-all font-mono hover:border-indigo-400/50"
              >
                Frosted Glass
              </button>
            </div>
          </div>

          {/* Right: Retouch Controls Panel (5 Cols) */}
          <div className="lg:col-span-5 p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
            
            {/* 1. Backdrop & Framing */}
            <div className="space-y-3">
              <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5 font-mono">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                1. Fondo de Estudio & Encuadre
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Fondo de Estudio</label>
                  <select
                    value={studioBackdrop}
                    onChange={(e) => setStudioBackdrop(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#121626] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="dark_studio">Obsidian Dark Studio</option>
                    <option value="minimal_white">Minimalist Pure White</option>
                    <option value="warm_sand">Warm Sand & Gold</option>
                    <option value="frosted_glass">Frosted Glass Blur</option>
                    <option value="transparent">Transparente (PNG)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#121626] border border-white/10 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  >
                    <option value="1:1">1:1 Cuadrado (1000x1000)</option>
                    <option value="4:5">4:5 Retrato (800x1000)</option>
                    <option value="16:9">16:9 Banner</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/[0.08] transition-colors">
                  <span className="text-xs text-slate-200">Aislamiento & Eliminación de Fondo</span>
                  <input
                    type="checkbox"
                    checked={removeBackground}
                    onChange={(e) => setRemoveBackground(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-white/10 border-white/20"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/[0.08] transition-colors">
                  <span className="text-xs text-slate-200">Iluminación de Estudio & Sombra de Suelo</span>
                  <input
                    type="checkbox"
                    checked={studioLighting}
                    onChange={(e) => setStudioLighting(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-white/10 border-white/20"
                  />
                </label>
              </div>
            </div>

            {/* 2. Color & Lighting Calibration */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5 font-mono">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                2. Calibración Óptica & Color
              </h3>

              {/* Sliders */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Brillo Óptico</span>
                    <span className="font-mono text-indigo-300 font-bold">+{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Contraste Dinámico</span>
                    <span className="font-mono text-indigo-300 font-bold">+{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="50"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Saturación Cromática</span>
                    <span className="font-mono text-indigo-300 font-bold">+{saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="50"
                    value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Nitidez & Claridad Textil</span>
                    <span className="font-mono text-indigo-300 font-bold">{sharpness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sharpness}
                    onChange={(e) => setSharpness(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Viñeta Suave de Enfoque</span>
                    <span className="font-mono text-indigo-300 font-bold">{vignette}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={vignette}
                    onChange={(e) => setVignette(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 3. Watermark & Branding */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                3. Sello de Autenticidad Victoriosa
              </h3>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setWatermark('none')}
                  className={`p-2 rounded-xl text-center border text-[11px] font-mono transition-all ${
                    watermark === 'none'
                      ? 'bg-indigo-600/20 border-indigo-400 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Sin Sello
                </button>
                <button
                  type="button"
                  onClick={() => setWatermark('subtle')}
                  className={`p-2 rounded-xl text-center border text-[11px] font-mono transition-all ${
                    watermark === 'subtle'
                      ? 'bg-indigo-600/20 border-indigo-400 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Monograma 'V'
                </button>
                <button
                  type="button"
                  onClick={() => setWatermark('victoriosa_badge')}
                  className={`p-2 rounded-xl text-center border text-[11px] font-mono transition-all ${
                    watermark === 'victoriosa_badge'
                      ? 'bg-indigo-600/20 border-indigo-400 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Distintivo Prémium
                </button>
              </div>
            </div>

            {/* Save & Publish Actions */}
            <div className="pt-4 border-t border-white/10 space-y-2.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveToFirebase}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Guardando en Firebase Storage...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Aplicar & Guardar Imagen #{selectedImageIndex + 1}</span>
                  </>
                )}
              </button>

              {images.length > 1 && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleBatchEnhanceAll}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs rounded-xl border border-white/10 transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Aplicar este Retoque a Todas las Fotos ({images.length})</span>
                </button>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
