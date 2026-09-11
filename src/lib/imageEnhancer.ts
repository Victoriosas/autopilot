import type { Product, ImageEnhancementOptions, EnhancedImageResult } from '../types';
import { uploadImageToStorage } from './firebase';

export const DEFAULT_ENHANCEMENT_OPTIONS: ImageEnhancementOptions = {
  targetWidth: 1000,
  targetHeight: 1000,
  aspectRatio: '1:1',
  fit: 'contain_padded',
  removeBackground: true,
  studioLighting: true,
  studioBackdrop: 'dark_studio',
  brightness: 4,
  contrast: 12,
  saturation: 10,
  sharpness: 25,
  vignette: 15,
  colorCorrection: true
};

/**
 * Loads an image from a URL safely handling cross-origin
 */
export function loadImageSafely(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Retry without CORS if tainted canvas is acceptable for display fallback
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
      fallbackImg.src = src;
    };
    img.src = src;
  });
}

/**
 * Client-side canvas image enhancement pipeline:
 * Resizing, standard aspect ratio framing, background studio lighting, and color correction
 */
export async function enhanceImageWithCanvas(
  imageSource: string | HTMLImageElement,
  options: Partial<ImageEnhancementOptions> = {}
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  appliedFilters: string[];
}> {
  const opts: ImageEnhancementOptions = { ...DEFAULT_ENHANCEMENT_OPTIONS, ...options };
  const appliedFilters: string[] = [];

  const img = typeof imageSource === 'string' ? await loadImageSafely(imageSource) : imageSource;

  // Calculate target dimensions based on aspect ratio
  let targetWidth = opts.targetWidth || 1000;
  let targetHeight = opts.targetHeight || 1000;

  if (opts.aspectRatio === '4:5') {
    targetHeight = Math.round(targetWidth * 1.25);
    appliedFilters.push('Aspect Ratio 4:5 (Luxury Portrait)');
  } else if (opts.aspectRatio === '16:9') {
    targetHeight = Math.round((targetWidth * 9) / 16);
    appliedFilters.push('Aspect Ratio 16:9 (Hero Banner)');
  } else {
    targetHeight = targetWidth;
    appliedFilters.push('Aspect Ratio 1:1 (Square Standard)');
  }

  appliedFilters.push(`Resolución HD ${targetWidth}x${targetHeight}px`);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // 1. Draw Studio Backdrop
  if (opts.studioBackdrop === 'dark_studio') {
    const grad = ctx.createRadialGradient(
      targetWidth * 0.5,
      targetHeight * 0.45,
      targetWidth * 0.1,
      targetWidth * 0.5,
      targetHeight * 0.5,
      targetWidth * 0.75
    );
    grad.addColorStop(0, '#1c2438');
    grad.addColorStop(0.5, '#0e1320');
    grad.addColorStop(1, '#080a11');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    appliedFilters.push('Studio Backdrop: Obsidian Dark Gradiente');
  } else if (opts.studioBackdrop === 'minimal_white') {
    const grad = ctx.createRadialGradient(
      targetWidth * 0.5,
      targetHeight * 0.4,
      targetWidth * 0.1,
      targetWidth * 0.5,
      targetHeight * 0.5,
      targetWidth * 0.7
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.7, '#f8fafc');
    grad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    appliedFilters.push('Studio Backdrop: White Pure Studio');
  } else if (opts.studioBackdrop === 'frosted_glass') {
    const grad = ctx.createLinearGradient(0, 0, targetWidth, targetHeight);
    grad.addColorStop(0, '#11172a');
    grad.addColorStop(0.5, '#0b0f1c');
    grad.addColorStop(1, '#182035');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    appliedFilters.push('Studio Backdrop: Frosted Glass Ambient');
  } else if (opts.studioBackdrop === 'warm_ambient') {
    const grad = ctx.createRadialGradient(
      targetWidth * 0.5,
      targetHeight * 0.45,
      targetWidth * 0.1,
      targetWidth * 0.5,
      targetHeight * 0.5,
      targetWidth * 0.75
    );
    grad.addColorStop(0, '#261e1b');
    grad.addColorStop(0.6, '#140f0d');
    grad.addColorStop(1, '#0a0807');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    appliedFilters.push('Studio Backdrop: Warm Champagne Luxe');
  } else {
    // Transparent or none
    ctx.clearRect(0, 0, targetWidth, targetHeight);
  }

  // 2. Draw ground contact shadow under subject
  if (opts.studioBackdrop !== 'transparent') {
    ctx.save();
    ctx.beginPath();
    const shadowY = targetHeight * 0.84;
    const shadowRadiusX = targetWidth * 0.32;
    const shadowRadiusY = targetHeight * 0.05;
    ctx.ellipse(targetWidth * 0.5, shadowY, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.filter = 'blur(16px)';
    ctx.fill();
    ctx.restore();
    appliedFilters.push('Sombra de Suelo Soft Grounding');
  }

  // 3. Render Product Image with Proportional Padding & Fitting
  const paddingRatio = opts.fit === 'contain_padded' ? 0.82 : 1.0;
  const availWidth = targetWidth * paddingRatio;
  const availHeight = targetHeight * paddingRatio;

  const imgAspect = img.width / img.height;
  let drawW: number;
  let drawH: number;

  if (opts.fit === 'cover') {
    if (imgAspect > targetWidth / targetHeight) {
      drawH = targetHeight;
      drawW = drawH * imgAspect;
    } else {
      drawW = targetWidth;
      drawH = drawW / imgAspect;
    }
  } else {
    // Contain within padded box
    if (imgAspect > availWidth / availHeight) {
      drawW = availWidth;
      drawH = drawW / imgAspect;
    } else {
      drawH = availHeight;
      drawW = drawH * imgAspect;
    }
  }

  const drawX = (targetWidth - drawW) / 2;
  const drawY = (targetHeight - drawH) / 2;

  // Apply subtle backdrop blend or draw directly
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  // 4. Pixel Level Color Correction & Enhancement
  try {
    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imgData.data;

    const contrastVal = opts.contrast ?? 12;
    const contrastFactor = (259 * (contrastVal + 255)) / (255 * (259 - contrastVal));
    const brightnessVal = opts.brightness ?? 4;
    const satVal = (opts.saturation ?? 10) / 100;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Brightness
      r += brightnessVal;
      g += brightnessVal;
      b += brightnessVal;

      // Contrast
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;

      // Saturation
      const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
      r = gray + (r - gray) * (1 + satVal);
      g = gray + (g - gray) * (1 + satVal);
      b = gray + (b - gray) * (1 + satVal);

      // Clamp
      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }

    ctx.putImageData(imgData, 0, 0);
    appliedFilters.push(`Corrección de Color (Brillo +${brightnessVal}, Contraste +${contrastVal}%, Saturación +${opts.saturation}%)`);
  } catch (pixelErr) {
    console.warn('Canvas pixel manipulation skipped (CORS/tainted):', pixelErr);
  }

  // 5. Studio Lighting Spotlight Sheen Overlay
  if (opts.studioLighting) {
    ctx.save();
    const lightGrad = ctx.createRadialGradient(
      targetWidth * 0.35,
      targetHeight * 0.25,
      10,
      targetWidth * 0.35,
      targetHeight * 0.25,
      targetWidth * 0.65
    );
    lightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    lightGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    lightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.restore();
    appliedFilters.push('Studio Key Light Top Spotlight');
  }

  // 6. Perimeter Vignette
  if ((opts.vignette ?? 15) > 0) {
    ctx.save();
    const vigGrad = ctx.createRadialGradient(
      targetWidth * 0.5,
      targetHeight * 0.5,
      targetWidth * 0.35,
      targetWidth * 0.5,
      targetHeight * 0.5,
      targetWidth * 0.72
    );
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, `rgba(0, 0, 0, ${(opts.vignette ?? 15) / 100})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.restore();
    appliedFilters.push(`Viñeteado Óptico (${opts.vignette}%)`);
  }

  // Export high quality JPEG data URL
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

  return {
    dataUrl,
    width: targetWidth,
    height: targetHeight,
    appliedFilters
  };
}

/**
 * Convenience wrapper for live canvas preview in ImageStudioModal
 */
export async function processProductImageInCanvas(
  imageUrl: string,
  options: Partial<ImageEnhancementOptions> = {}
): Promise<{
  enhancedDataUrl: string;
  width: number;
  height: number;
  appliedFilters: string[];
}> {
  const res = await enhanceImageWithCanvas(imageUrl, options);
  return {
    enhancedDataUrl: res.dataUrl,
    width: res.width,
    height: res.height,
    appliedFilters: res.appliedFilters
  };
}

/**
 * Enhances a product's image and persists the result to Firebase Storage and Firestore
 */
export async function enhanceAndPersistProductImage(
  product: Product,
  imageIndex: number = 0,
  options: Partial<ImageEnhancementOptions> = {}
): Promise<{
  enhancedResult: EnhancedImageResult;
  updatedProduct: Product;
}> {
  const originalImageUrl = product.originalImages?.[imageIndex] || product.images[imageIndex] || product.images[0];
  
  // 1. Process image in canvas
  const { dataUrl, width, height, appliedFilters } = await enhanceImageWithCanvas(originalImageUrl, options);

  // 2. Upload to Firebase Storage
  const storagePath = `products/${product.id}/enhanced_v${Date.now()}_img${imageIndex}.jpg`;
  const storageUrl = await uploadImageToStorage(dataUrl, storagePath);

  // 3. Build EnhancedImageResult object
  const enhancedResult: EnhancedImageResult = {
    id: `enh-${Date.now()}-${imageIndex}`,
    originalUrl: originalImageUrl,
    enhancedUrl: storageUrl || dataUrl,
    storagePath,
    storageUrl: storageUrl || dataUrl,
    processedAt: new Date().toISOString(),
    dimensions: { width, height },
    aspectRatio: options.aspectRatio || '1:1',
    appliedFilters,
    fileSizeEstimated: `~${Math.round(dataUrl.length * 0.75 / 1024)} KB`
  };

  // 4. Update Product structure
  const updatedImages = [...product.images];
  updatedImages[imageIndex] = storageUrl || dataUrl;

  const existingEnhancements = product.imageEnhancements ? [...product.imageEnhancements] : [];
  existingEnhancements.push(enhancedResult);

  const updatedProduct: Product = {
    ...product,
    images: updatedImages,
    originalImages: product.originalImages?.length ? product.originalImages : [originalImageUrl],
    imageEnhancements: existingEnhancements,
    isImageEnhanced: true
  };

  return {
    enhancedResult,
    updatedProduct
  };
}
