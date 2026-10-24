// Minimal markdown renderer for our own docs: headings, lists, paragraphs, **bold**, `code`.
// Builds React elements only — no dangerouslySetInnerHTML, so text is always escaped.
import React from 'react';

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(tok.startsWith('**') ? <strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong> : <code key={`${key}-${i++}`} className="text-[0.9em] px-1 rounded bg-slate-100 dark:bg-slate-800">{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ol'; start: number; items: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'p'; text: string };

export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    const ol = /^(\d+)\.\s+(.*)$/.exec(t);
    const ul = /^[-*]\s+(.*)$/.exec(t);
    const prev = blocks.at(-1);
    if (h) blocks.push({ kind: 'h', level: h[1].length, text: h[2] });
    else if (ol) {
      if (prev?.kind === 'ol') prev.items.push(ol[2]);
      else blocks.push({ kind: 'ol', start: Number(ol[1]), items: [ol[2]] }); // keep source numbering across sections
    } else if (ul) {
      if (prev?.kind === 'ul') prev.items.push(ul[1]);
      else blocks.push({ kind: 'ul', items: [ul[1]] });
    } else blocks.push({ kind: 'p', text: t });
  }
  return blocks;
}

export function SafeMarkdown({ source }: { source: string }) {
  return (
    <div className="space-y-2 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
      {parseBlocks(source).map((b, i) => {
        const k = `b${i}`;
        if (b.kind === 'h') {
          const Tag = (['h3', 'h3', 'h4', 'h5'] as const)[b.level - 1];
          return <Tag key={k} className="font-bold text-slate-900 dark:text-white pt-2">{inline(b.text, k)}</Tag>;
        }
        if (b.kind === 'p') return <p key={k}>{inline(b.text, k)}</p>;
        if (b.kind === 'ol') {
          return (
            <ol key={k} start={b.start !== 1 ? b.start : undefined} className="list-decimal pl-5 space-y-1">
              {b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}
            </ol>
          );
        }
        return (
          <ul key={k} className="list-disc pl-5 space-y-1">
            {b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}
          </ul>
        );
      })}
    </div>
  );
}
