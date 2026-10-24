'use client';

export interface CompositeOptions {
  baseImageSrc: string;
  format?: 'feed_4_5' | 'feed_1_1' | 'story_9_16' | 'reel_9_16';
  offerText?: string;
  wordmarkBandColor?: 'paper' | 'ink';
  showOfferBand?: boolean;
}

export const FORMAT_DIMENSIONS: Record<string, { width: number; height: number; ratio: number }> = {
  feed_4_5: { width: 1080, height: 1350, ratio: 4 / 5 },
  feed_1_1: { width: 1080, height: 1080, ratio: 1 },
  story_9_16: { width: 1080, height: 1920, ratio: 9 / 16 },
  reel_9_16: { width: 1080, height: 1920, ratio: 9 / 16 },
};

/**
 * Client-side HTML5 Canvas Compositor.
 * Strictly adheres to Vercel and Brand Gate constraints:
 * 1. Never renders text onto images on the server with Sharp (serverless has no system fonts).
 * 2. Composites Thrift-It wordmark on a Paper or Ink backing band with clear space >= 34px.
 * 3. Renders Marigold offer band with Ink typography for verified WCAG contrast.
 */
export async function compositeBrandPost(options: CompositeOptions): Promise<string> {
  const {
    baseImageSrc,
    format = 'feed_4_5',
    offerText,
    wordmarkBandColor = 'paper',
    showOfferBand = Boolean(offerText),
  } = options;

  if (typeof window === 'undefined') {
    return baseImageSrc;
  }

  const { width, height } = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS.feed_4_5;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return baseImageSrc;

  // 1. Load and draw the base image with center-crop ("cover")
  const baseImg = await loadImage(baseImageSrc);
  const srcRatio = baseImg.width / baseImg.height;
  const targetRatio = width / height;

  let renderWidth = width;
  let renderHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (srcRatio > targetRatio) {
    renderWidth = height * srcRatio;
    offsetX = (width - renderWidth) / 2;
  } else {
    renderHeight = width / srcRatio;
    offsetY = (height - renderHeight) / 2;
  }

  ctx.fillStyle = '#FAF6EE';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(baseImg, offsetX, offsetY, renderWidth, renderHeight);

  // 2. Composite Wordmark with Paper or Ink backing band
  // Rule VI-002 / VI-004: Clear space equals height of 'T' (34px); never place on busy backgrounds without band
  const bandPaddingX = 36;
  const bandPaddingY = 18;
  const wordmarkWidth = 240;
  const wordmarkHeight = 60;
  const bandWidth = wordmarkWidth + bandPaddingX * 2;
  const bandHeight = wordmarkHeight + bandPaddingY * 2;

  const bandX = 48;
  const bandY = 48;

  // Draw Wordmark Band
  ctx.save();
  ctx.shadowColor = 'rgba(27, 27, 31, 0.18)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;

  ctx.fillStyle = wordmarkBandColor === 'paper' ? '#FAF6EE' : '#1B1B1F';
  drawRoundedRect(ctx, bandX, bandY, bandWidth, bandHeight, 16);
  ctx.fill();
  ctx.restore();

  // Draw Wordmark Text
  // "Thrift-It" with Marigold hyphen
  ctx.textBaseline = 'middle';
  const textX = bandX + bandPaddingX + 12;
  const textY = bandY + bandHeight / 2 + 2;

  ctx.font = '900 42px Inter, system-ui, -apple-system, sans-serif';
  const textColor = wordmarkBandColor === 'paper' ? '#1B1B1F' : '#FAF6EE';
  ctx.fillStyle = textColor;
  ctx.fillText('Thrift', textX, textY);

  const thriftWidth = ctx.measureText('Thrift').width;
  ctx.fillStyle = '#F2A900'; // Marigold accent hyphen
  ctx.fillText('-', textX + thriftWidth + 1, textY);

  const hyphenWidth = ctx.measureText('-').width;
  ctx.fillStyle = textColor;
  ctx.fillText('It', textX + thriftWidth + hyphenWidth + 1, textY);

  // 3. Composite Offer Band (if specified)
  // Marigold background with Ink text for optimal contrast
  if (showOfferBand && offerText) {
    const offerBandHeight = 72;
    const offerBandY = height - offerBandHeight - 48;
    const offerBandX = 48;
    const offerBandWidth = width - 96;

    ctx.save();
    ctx.shadowColor = 'rgba(27, 27, 31, 0.25)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;

    ctx.fillStyle = '#F2A900'; // Marigold fill
    drawRoundedRect(ctx, offerBandX, offerBandY, offerBandWidth, offerBandHeight, 14);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#1B1B1F'; // Ink text (4.5:1+ compliant over Marigold)
    ctx.font = '800 24px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(offerText.toUpperCase(), width / 2, offerBandY + offerBandHeight / 2 + 1);
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
