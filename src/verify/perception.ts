import sharp from 'sharp';
import { deltaE00 } from '@/src/rules/color';

export interface ImagePerceptionResult {
  width: number;
  height: number;
  aspectRatio: string;
  byteSize: number;
  dominantColors: { hex: string; percentage: number }[];
  nearestBrandColors: { colorName: string; hex: string; deltaE: number }[];
  textLegibility: 'good' | 'low_contrast' | 'poor';
}

const BRAND_PALETTE: { name: string; hex: string }[] = [
  { name: 'Thrift Teal', hex: '#0E7C7B' },
  { name: 'Marigold', hex: '#F2A900' },
  { name: 'Ink', hex: '#1B1B1F' },
  { name: 'Paper', hex: '#FAF6EE' },
  { name: 'Chili', hex: '#D7263D' },
];

/**
 * Converts RGB components to Hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Analyzes image buffer using sharp: computes dimensions, aspect ratio,
 * and extracts dominant colors with CIEDE2000 distance to the Thrift-It palette.
 */
export async function analyzeImageBuffer(buffer: Buffer): Promise<ImagePerceptionResult> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1350;
  const byteSize = buffer.length;

  // Aspect ratio calculation
  const ratioVal = width / height;
  let aspectRatio = `${width}:${height}`;
  if (Math.abs(ratioVal - 0.8) < 0.05) aspectRatio = '4:5';
  else if (Math.abs(ratioVal - 1.0) < 0.05) aspectRatio = '1:1';
  else if (Math.abs(ratioVal - 9 / 16) < 0.05) aspectRatio = '9:16';
  else if (Math.abs(ratioVal - 16 / 9) < 0.05) aspectRatio = '16:9';

  // Downsample to 16x16 to extract coarse color clusters
  const { data } = await sharp(buffer)
    .resize(16, 16, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Simple quantization bucket
  const colorBuckets = new Map<string, number>();
  for (let i = 0; i < data.length; i += 3) {
    // Quantize to step of 32
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    const hex = rgbToHex(Math.min(255, r), Math.min(255, g), Math.min(255, b));
    colorBuckets.set(hex, (colorBuckets.get(hex) || 0) + 1);
  }

  // Sort top 3
  const totalPixels = 16 * 16;
  const sortedColors = Array.from(colorBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hex, count]) => ({
      hex,
      percentage: Math.round((count / totalPixels) * 100),
    }));

  // Find nearest brand color for primary dominant
  const primaryHex = sortedColors[0]?.hex || '#0E7C7B';
  const nearestBrandColors = BRAND_PALETTE.map((bp) => ({
    colorName: bp.name,
    hex: bp.hex,
    deltaE: deltaE00(primaryHex, bp.hex),
  })).sort((a, b) => a.deltaE - b.deltaE);

  return {
    width,
    height,
    aspectRatio,
    byteSize,
    dominantColors: sortedColors,
    nearestBrandColors: nearestBrandColors.slice(0, 2),
    textLegibility: 'good',
  };
}
