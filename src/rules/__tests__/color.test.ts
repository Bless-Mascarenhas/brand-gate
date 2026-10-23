import { describe, it, expect } from 'vitest';
import { getContrastRatio, getRelativeLuminance, hexToRgb, deltaE00 } from '../color';

describe('Color Math & Accessibility Contrast (Phase 3)', () => {
  it('correctly parses hex colors to RGB', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#F2A900')).toEqual({ r: 242, g: 169, b: 0 });
  });

  it('calculates relative luminance according to WCAG 2.1 specs', () => {
    const whiteLum = getRelativeLuminance({ r: 255, g: 255, b: 255 });
    const blackLum = getRelativeLuminance({ r: 0, g: 0, b: 0 });
    expect(whiteLum).toBeCloseTo(1.0, 2);
    expect(blackLum).toBeCloseTo(0.0, 2);
  });

  it('calculates exact 21:1 contrast for black on white', () => {
    const contrast = getContrastRatio('#000000', '#FFFFFF');
    expect(contrast).toBe(21);
  });

  it('proves the planted VI vs AR brand tension: Marigold on Paper fails 4.5:1', () => {
    // Marigold: #F2A900, Paper: #FAF6EE
    const marigoldOnPaper = getContrastRatio('#F2A900', '#FAF6EE');
    // Contrast is approx 1.7:1
    expect(marigoldOnPaper).toBeLessThan(4.5);
    expect(marigoldOnPaper).toBeLessThan(2.0);
  });

  it('proves the resolved VI styling: Ink on Marigold easily passes 4.5:1', () => {
    // Ink: #1B1B1F, Marigold: #F2A900
    const inkOnMarigold = getContrastRatio('#1B1B1F', '#F2A900');
    expect(inkOnMarigold).toBeGreaterThanOrEqual(4.5);
  });

  it('calculates CIEDE2000 ΔE between identical colors as 0', () => {
    const de = deltaE00('#0E7C7B', '#0E7C7B');
    expect(de).toBe(0);
  });

  it('calculates perceptual difference between Thrift Teal and Marigold', () => {
    const de = deltaE00('#0E7C7B', '#F2A900');
    expect(de).toBeGreaterThan(30);
  });
});
