/**
 * Color math utilities:
 * 1. WCAG 2.1 Relative Luminance and Contrast Ratio
 * 2. sRGB to CIELAB conversion
 * 3. CIEDE2000 color difference (ΔE00)
 */

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export function hexToRgb(hex: string): RGB {
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Calculates WCAG 2.1 relative luminance
 * Formula: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(rgb: RGB): number {
  const [sR, sG, sB] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((val) => {
    return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sR + 0.7152 * sG + 0.0722 * sB;
}

/**
 * Calculates WCAG 2.1 contrast ratio between two colors
 * Returns a value between 1 and 21
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hexToRgb(hex1));
  const lum2 = getRelativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

/**
 * Converts sRGB to CIELAB for perceptual color distance
 */
export function rgbToLab(rgb: RGB): [number, number, number] {
  // sRGB to XYZ (D65)
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  const L = 116 * y - 16;
  const a = 500 * (x - y);
  const b_lab = 200 * (y - z);

  return [L, a, b_lab];
}

/**
 * Standard CIEDE2000 color difference formula (ΔE00)
 */
export function deltaE00(hex1: string, hex2: string): number {
  const lab1 = rgbToLab(hexToRgb(hex1));
  const lab2 = rgbToLab(hexToRgb(hex2));

  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1Prime = (1 + G) * a1;
  const a2Prime = (1 + G) * a2;

  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);

  const h1Prime =
    (Math.atan2(b1, a1Prime) * 180) / Math.PI +
    ((Math.atan2(b1, a1Prime) * 180) / Math.PI < 0 ? 360 : 0);
  const h2Prime =
    (Math.atan2(b2, a2Prime) * 180) / Math.PI +
    ((Math.atan2(b2, a2Prime) * 180) / Math.PI < 0 ? 360 : 0);

  const avgCPrime = (C1Prime + C2Prime) / 2;

  let deltahPrime = 0;
  if (C1Prime * C2Prime !== 0) {
    if (Math.abs(h1Prime - h2Prime) <= 180) {
      deltahPrime = h2Prime - h1Prime;
    } else if (h2Prime <= h1Prime) {
      deltahPrime = h2Prime - h1Prime + 360;
    } else {
      deltahPrime = h2Prime - h1Prime - 360;
    }
  }

  const deltaLPrime = L2 - L1;
  const deltaCPrime = C2Prime - C1Prime;
  const deltaHPrime =
    2 * Math.sqrt(C1Prime * C2Prime) * Math.sin(((deltahPrime / 2) * Math.PI) / 180);

  let avghPrime = (h1Prime + h2Prime) / 2;
  if (C1Prime * C2Prime !== 0 && Math.abs(h1Prime - h2Prime) > 180) {
    avghPrime += avghPrime < 180 ? 180 : -180;
  }

  const T =
    1 -
    0.17 * Math.cos(((avghPrime - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * avghPrime) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avghPrime + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * avghPrime - 63) * Math.PI) / 180);

  const SL = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const SC = 1 + 0.045 * avgCPrime;
  const SH = 1 + 0.015 * avgCPrime * T;

  const deltaTheta = 30 * Math.exp(-Math.pow((avghPrime - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(avgCPrime, 7) / (Math.pow(avgCPrime, 7) + Math.pow(25, 7)));
  const RT = -Math.sin(((2 * deltaTheta) * Math.PI) / 180) * RC;

  const dE = Math.sqrt(
    Math.pow(deltaLPrime / SL, 2) +
      Math.pow(deltaCPrime / SC, 2) +
      Math.pow(deltaHPrime / SH, 2) +
      RT * (deltaCPrime / SC) * (deltaHPrime / SH)
  );

  return Math.round(dE * 100) / 100;
}
