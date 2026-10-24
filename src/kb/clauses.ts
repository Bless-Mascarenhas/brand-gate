// Pure (browser-safe) clause indexing and pack hashing shared by the server loader and the Company editor.
import { Clause, FactEntry, PolicyDoc, Rule } from '@/src/types';

export function parseClausesFromMarkdown(content: string, docId: string, docTitle: string): Clause[] {
  const clauses: Clause[] = [];
  // Match [PREFIX-NNN] followed by text up to next [PREFIX-NNN] or end
  const regex = /\[([A-Z]{2,3}-\d{3})\]\s*([\s\S]*?)(?=(?:\[[A-Z]{2,3}-\d{3}\])|$)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const id = match[1].trim();
    const rawText = match[2].trim();
    if (id && rawText) {
      clauses.push({ id, docId, docTitle, text: rawText });
    }
  }

  return clauses;
}

/** The exact string that is hashed into the pack hash. Server and browser must agree on it. */
export function packHashInput(docs: Pick<PolicyDoc, 'id' | 'clauses'>[], facts: FactEntry[], rules: Rule[]): string {
  return JSON.stringify({
    docs: docs.map((d) => ({ id: d.id, clauses: d.clauses.map((c) => ({ id: c.id, text: c.text })) })),
    facts,
    rules, // full rule definitions, so a pattern or severity change bumps the hash
  });
}

/** SHA-256 pack hash via Web Crypto (available in browsers and Node ≥ 19). */
export async function computePackHash(docs: Pick<PolicyDoc, 'id' | 'clauses'>[], facts: FactEntry[], rules: Rule[]): Promise<string> {
  const bytes = new TextEncoder().encode(packHashInput(docs, facts, rules));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return 'pack_' + hex.slice(0, 12);
}
