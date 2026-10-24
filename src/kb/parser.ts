import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseClausesFromMarkdown, packHashInput } from './clauses';
import { Clause, PolicyDoc, PolicyPack, FactEntry, Rule, Asset, MarketConfig } from '@/src/types';

const THRIFT_IT_DIR = path.join(process.cwd(), 'data', 'thrift-it');

const DOC_METADATA: { filename: string; id: string; prefix: string }[] = [
  { filename: 'brand-voice.md', id: 'DOC-BV-001', prefix: 'BV' },
  { filename: 'terminology.md', id: 'DOC-TM-001', prefix: 'TM' },
  { filename: 'approved-facts.md', id: 'DOC-AF-001', prefix: 'AF' },
  { filename: 'claims-policy.md', id: 'DOC-CL-001', prefix: 'CL' },
  { filename: 'visual-identity.md', id: 'DOC-VI-001', prefix: 'VI' },
  { filename: 'accessibility-rules.md', id: 'DOC-AR-001', prefix: 'AR' },
  { filename: 'social-rules.md', id: 'DOC-SR-001', prefix: 'SR' },
  { filename: 'escalation-matrix.md', id: 'DOC-EM-001', prefix: 'EM' },
];

export { parseClausesFromMarkdown } from './clauses';

export function loadPolicyPack(): PolicyPack {
  const docs: PolicyDoc[] = [];
  const allClauses: Clause[] = [];

  for (const meta of DOC_METADATA) {
    const filePath = path.join(THRIFT_IT_DIR, meta.filename);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract title
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : meta.filename;

    // Extract version
    const versionMatch = content.match(/\*\*Version:\*\*\s*([^\n\r]+)/);
    const version = versionMatch ? versionMatch[1].trim() : '1.0.0';

    // Extract effective date
    const dateMatch = content.match(/\*\*Effective Date:\*\*\s*([^\n\r]+)/);
    const effectiveDate = dateMatch ? dateMatch[1].trim() : '2026-08-01';

    // Extract owner
    const ownerMatch = content.match(/\*\*Owner:\*\*\s*([^\n\r]+)/);
    const owner = ownerMatch ? ownerMatch[1].trim() : 'Brand Gate Governance Team';

    const clauses = parseClausesFromMarkdown(content, meta.id, title);
    allClauses.push(...clauses);

    docs.push({
      id: meta.id,
      title,
      prefix: meta.prefix,
      version,
      effectiveDate,
      owner,
      content,
      clauses,
    });
  }

  // Load Facts, Rules, Assets, Market
  const factsRaw = fs.readFileSync(path.join(THRIFT_IT_DIR, 'facts.json'), 'utf-8');
  const facts: FactEntry[] = JSON.parse(factsRaw);

  const rulesRaw = fs.readFileSync(path.join(THRIFT_IT_DIR, 'rules.json'), 'utf-8');
  const rules: Rule[] = JSON.parse(rulesRaw);

  const assetsRaw = fs.readFileSync(path.join(THRIFT_IT_DIR, 'assets.json'), 'utf-8');
  const assets: Asset[] = JSON.parse(assetsRaw);

  const marketRaw = fs.readFileSync(path.join(THRIFT_IT_DIR, 'market.json'), 'utf-8');
  const market: MarketConfig = JSON.parse(marketRaw);

  // Compute deterministic snapshot hash
  const hashInput = packHashInput(docs, facts, rules);
  const hash = 'pack_' + crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 12);

  return {
    version: '1.0.0',
    hash,
    docs,
    clauses: allClauses,
    facts,
    rules,
    assets,
    market,
  };
}

let cachedPack: PolicyPack | null = null;

export function getPolicyPack(): PolicyPack {
  if (!cachedPack) {
    cachedPack = loadPolicyPack();
  }
  return cachedPack;
}
