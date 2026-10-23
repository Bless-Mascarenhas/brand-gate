import { describe, it, expect } from 'vitest';
import { countEmojis, extractEmojis } from '../emoji';

describe('Emoji Grapheme Counting & Detection (Phase 3)', () => {
  it('counts 0 for plain text without emojis', () => {
    expect(countEmojis('Curated vintage collection for Diwali.')).toBe(0);
  });

  it('counts standard single-codepoint emojis', () => {
    expect(countEmojis('Diwali vibes ✨')).toBe(1);
    expect(countEmojis('Diwali vibes ✨ 👗')).toBe(2);
    expect(countEmojis('✨ 👗 🪔')).toBe(3);
  });

  it('handles multi-codepoint flag emojis as single emojis', () => {
    // Indian flag 🇮🇳 (2 regional indicator symbols)
    expect(countEmojis('Made for 🇮🇳')).toBe(1);
  });

  it('handles skin-tone modifier emojis as a single grapheme cluster', () => {
    // Wave with medium skin tone 👋🏽
    expect(countEmojis('Hello yaaron 👋🏽')).toBe(1);
  });

  it('extracts emoji list accurately', () => {
    const list = extractEmojis('Sparkle ✨ and lamp 🪔 in Bandra');
    expect(list).toEqual(['✨', '🪔']);
  });
});
