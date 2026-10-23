/**
 * Grapheme cluster-aware emoji counting using Intl.Segmenter.
 * Accurately handles multi-codepoint sequences, skin-tone modifiers,
 * zero-width joiners (ZWJ), flags, and variation selectors.
 */

// Regex for emoji presentation and pictographic grapheme clusters
const EMOJI_REGEX = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/u;

export function countEmojis(text: string): number {
  if (!text) return 0;

  // Use Intl.Segmenter with grapheme granularity
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let count = 0;
    for (const segment of segmenter.segment(text)) {
      if (EMOJI_REGEX.test(segment.segment)) {
        count++;
      }
    }
    return count;
  }

  // Fallback for environments lacking Intl.Segmenter
  const matches = text.match(/[\p{Extended_Pictographic}]/gu);
  return matches ? matches.length : 0;
}

export function extractEmojis(text: string): string[] {
  if (!text) return [];

  const emojis: string[] = [];
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    for (const segment of segmenter.segment(text)) {
      if (EMOJI_REGEX.test(segment.segment)) {
        emojis.push(segment.segment);
      }
    }
    return emojis;
  }

  const matches = text.match(/[\p{Extended_Pictographic}]/gu);
  return matches || [];
}
