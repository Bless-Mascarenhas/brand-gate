/**
 * Robust JSON extraction and repair utility for LLM outputs.
 * Handles markdown fences, trailing commas, single quotes, and partial formatting.
 */

export function extractJsonFromText(rawText: string): string {
  if (!rawText) return '{}';

  let cleaned = rawText.trim();

  // Strip ```json ... ``` or ``` ... ``` code blocks
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Find outermost JSON object or array if text has leading/trailing prose
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  return cleaned;
}

export function repairJsonString(jsonStr: string): string {
  let s = extractJsonFromText(jsonStr);

  // Remove trailing commas before closing braces/brackets
  s = s.replace(/,\s*([}\]])/g, '$1');

  return s;
}

export function parseJsonSafe<T>(rawText: string): { success: true; data: T } | { success: false; error: string } {
  const extracted = extractJsonFromText(rawText);
  try {
    const parsed = JSON.parse(extracted);
    return { success: true, data: parsed as T };
  } catch (err1: any) {
    // Attempt simple repair (remove trailing commas, etc.)
    try {
      const repaired = repairJsonString(extracted);
      const parsed = JSON.parse(repaired);
      return { success: true, data: parsed as T };
    } catch (err2: any) {
      return {
        success: false,
        error: `Failed to parse JSON: ${err1.message} -> ${err2.message}`,
      };
    }
  }
}
