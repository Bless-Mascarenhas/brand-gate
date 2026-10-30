import {
  Finding,
  PolicyPack,
  PostContent,
  Clause,
} from '@/src/types';
import { countEmojis } from './emoji';

export interface GateEvaluationResult {
  passed: boolean;
  score: number;
  findings: Finding[];
  gatesFailed: string[];
}

/**
 * Extracts a concise verbatim quote from the clause text
 */
function extractClauseQuote(clause: Clause, targetTerm?: string): string {
  if (targetTerm && clause.text.toLowerCase().includes(targetTerm.toLowerCase())) {
    const idx = clause.text.toLowerCase().indexOf(targetTerm.toLowerCase());
    const start = Math.max(0, clause.text.lastIndexOf('.', idx) + 1);
    let end = clause.text.indexOf('.', idx + targetTerm.length);
    if (end === -1) end = clause.text.length;
    return clause.text.slice(start, end).trim();
  }

  // Fallback to the first sentence of the clause
  const firstSentenceEnd = clause.text.indexOf('.');
  if (firstSentenceEnd !== -1) {
    return clause.text.slice(0, firstSentenceEnd + 1).trim();
  }
  return clause.text.slice(0, 100).trim();
}

/**
 * Deterministic rule engine evaluating post against all rules in the pack
 */
export function evaluatePost(
  post: PostContent,
  pack: PolicyPack,
  demoDate: string = '2026-10-24'
): GateEvaluationResult {
  const findings: Finding[] = [];
  const clauseMap = new Map<string, Clause>(pack.clauses.map((c) => [c.id, c]));

  const caption = post.caption || '';
  const hashtags = post.hashtags || [];
  const hashtagsString = hashtags.join(' ');
  const altText = post.altText || '';

  for (const rule of pack.rules) {
    const clause = clauseMap.get(rule.clause);
    if (!clause) continue;

    // 1. INJECTION PATTERN
    if (rule.type === 'injection_pattern') {
      const fieldsToCheck: Array<{ name: 'caption' | 'hashtags' | 'alt_text'; text: string }> = [
        { name: 'caption', text: caption },
        { name: 'hashtags', text: hashtagsString },
        { name: 'alt_text', text: altText },
      ];

      let matched = false;
      for (const field of fieldsToCheck) {
        if (!field.text) continue;
        const lower = field.text.toLowerCase();
        const normalized = lower.replace(/[^a-z0-9]/g, '');

        for (const term of rule.terms || []) {
          const lowerTerm = term.toLowerCase();
          const normTerm = lowerTerm.replace(/[^a-z0-9]/g, '');

          let postQuote = '';
          const idx = lower.indexOf(lowerTerm);
          if (idx !== -1) {
            postQuote = field.text.slice(idx, idx + term.length);
          } else if (normTerm && normalized.includes(normTerm)) {
            postQuote = field.text;
          }

          if (postQuote) {
            findings.push({
              id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
              source: 'gate',
              category: rule.category,
              severity: rule.severity,
              clauseId: rule.clause,
              clauseQuote: extractClauseQuote(clause, 'never'),
              postField: field.name,
              postQuote,
              explanation: rule.message,
              autoFixable: false,
              confidence: 1.0,
              verified: true,
              agreement: 'deterministic',
            });
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      continue;
    }

    // 2. BANNED TERM
    if (rule.type === 'banned_term') {
      for (const fieldName of rule.fields) {
        let textToSearch = '';
        if (fieldName === 'caption') textToSearch = caption;
        else if (fieldName === 'hashtags') textToSearch = hashtagsString;
        else if (fieldName === 'alt_text') textToSearch = altText;

        if (!textToSearch) continue;

        for (const term of rule.terms || []) {
          let isMatch = false;
          let matchQuote = '';

          if (rule.match === 'word') {
            const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
            const match = textToSearch.match(regex);
            if (match) {
              isMatch = true;
              matchQuote = match[0];
            }
          } else {
            const idx = textToSearch.toLowerCase().indexOf(term.toLowerCase());
            if (idx !== -1) {
              isMatch = true;
              matchQuote = textToSearch.slice(idx, idx + term.length);
            }
          }

          if (isMatch) {
            const fix = rule.suggest?.[term.toLowerCase()] || rule.suggest?.[term];
            findings.push({
              id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
              source: 'gate',
              category: rule.category,
              severity: rule.severity,
              clauseId: rule.clause,
              clauseQuote: extractClauseQuote(clause, term),
              postField: fieldName as any,
              postQuote: matchQuote,
              explanation: rule.message,
              suggestedFix: fix,
              autoFixable: Boolean(rule.autoFix && fix),
              confidence: 1.0,
              verified: true,
              agreement: 'deterministic',
            });
            break; // report first violation of rule per field
          }
        }
      }
      continue;
    }

    // 3. REQUIRED TERM
    if (rule.type === 'required_term') {
      for (const term of rule.terms || []) {
        const inCaption = caption.toLowerCase().includes(term.toLowerCase());
        const inHashtags = hashtags.some((h) => h.toLowerCase() === term.toLowerCase());

        if (!inCaption && !inHashtags) {
          findings.push({
            id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
            source: 'gate',
            category: rule.category,
            severity: rule.severity,
            clauseId: rule.clause,
            clauseQuote: extractClauseQuote(clause, term),
            postField: 'hashtags',
            postQuote: hashtagsString || (caption ? caption.slice(0, 20) : 'none'),
            explanation: rule.message,
            suggestedFix: rule.suggest?.add || term,
            autoFixable: Boolean(rule.autoFix),
            confidence: 1.0,
            verified: true,
            agreement: 'deterministic',
          });
        }
      }
      continue;
    }

    // 4. REGEX
    if (rule.type === 'regex') {
      if (!rule.pattern) continue;
      const regex = new RegExp(rule.pattern, rule.flags || 'i');
      const match = caption.match(regex);
      if (match) {
        findings.push({
          id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
          source: 'gate',
          category: rule.category,
          severity: rule.severity,
          clauseId: rule.clause,
          clauseQuote: extractClauseQuote(clause),
          postField: 'caption',
          postQuote: match[0],
          explanation: rule.message,
          suggestedFix: rule.suggest?.[match[0]],
          autoFixable: Boolean(rule.autoFix && rule.suggest?.[match[0]]),
          confidence: 1.0,
          verified: true,
          agreement: 'deterministic',
        });
      }
      continue;
    }

    // 5. COUNT MAX / MIN
    if (rule.type === 'count_max') {
      if (rule.clause === 'SR-005') {
        // Emoji count limit (stricter SR: 2)
        const emojiCount = countEmojis(caption);
        if (rule.max !== undefined && emojiCount > rule.max) {
          findings.push({
            id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
            source: 'gate',
            category: rule.category,
            severity: rule.severity,
            clauseId: rule.clause,
            clauseQuote: extractClauseQuote(clause, '2 emojis'),
            postField: 'caption',
            postQuote: caption.slice(0, Math.min(30, caption.length)),
            explanation: `Found ${emojiCount} emojis; maximum permitted is ${rule.max}.`,
            autoFixable: false,
            confidence: 1.0,
            verified: true,
            agreement: 'deterministic',
          });
        }
      } else if (rule.clause === 'BV-006') {
        // Exclamation marks max 2
        const exclamations = (caption.match(/!/g) || []).length;
        if (rule.max !== undefined && exclamations > rule.max) {
          findings.push({
            id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
            source: 'gate',
            category: 'tone',
            severity: rule.severity,
            clauseId: rule.clause,
            clauseQuote: extractClauseQuote(clause, '2 exclamation marks'),
            postField: 'caption',
            postQuote: caption.slice(caption.indexOf('!'), caption.indexOf('!') + 5),
            explanation: `Found ${exclamations} exclamation marks; maximum permitted is ${rule.max}.`,
            autoFixable: false,
            confidence: 1.0,
            verified: true,
            agreement: 'deterministic',
          });
        }
      } else if (rule.clause === 'BV-008') {
        // ALL CAPS words max 1
        const capsWords = caption.match(/\b[A-Z]{3,}\b/g) || [];
        if (rule.max !== undefined && capsWords.length > rule.max) {
          findings.push({
            id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
            source: 'gate',
            category: 'tone',
            severity: rule.severity,
            clauseId: rule.clause,
            clauseQuote: extractClauseQuote(clause, 'ALL-CAPS'),
            postField: 'caption',
            postQuote: capsWords.join(' '),
            explanation: `Found ${capsWords.length} ALL-CAPS words (${capsWords.join(', ')}); at most ${rule.max} permitted.`,
            autoFixable: false,
            confidence: 1.0,
            verified: true,
            agreement: 'deterministic',
          });
        }
      } else if (rule.clause === 'AR-004') {
        // Hashtags count max 8
        if (rule.max !== undefined && hashtags.length > rule.max) {
          findings.push({
            id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
            source: 'gate',
            category: 'accessibility',
            severity: rule.severity,
            clauseId: rule.clause,
            clauseQuote: extractClauseQuote(clause, '8 hashtags'),
            postField: 'hashtags',
            postQuote: hashtags.slice(0, 3).join(' '),
            explanation: `Found ${hashtags.length} hashtags; maximum permitted is ${rule.max}.`,
            autoFixable: false,
            confidence: 1.0,
            verified: true,
            agreement: 'deterministic',
          });
        }
      } else if (rule.clause === 'SR-003') {
        // Caption length max 600
        if (rule.max !== undefined && caption.length > rule.max) {
          findings.push({
            id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
            source: 'gate',
            category: rule.category,
            severity: rule.severity,
            clauseId: rule.clause,
            clauseQuote: extractClauseQuote(clause, '600 characters'),
            postField: 'caption',
            postQuote: caption.slice(590, 610),
            explanation: `Caption length is ${caption.length} characters; maximum permitted is ${rule.max}.`,
            autoFixable: false,
            confidence: 1.0,
            verified: true,
            agreement: 'deterministic',
          });
        }
      }
      continue;
    }

    // 6. HASHTAG CAMELCASE
    if (rule.type === 'hashtag_camelcase') {
      const nonCamel = hashtags.filter((h) => {
        const clean = h.replace('#', '');
        // Check if all lowercase and length > 3
        return clean === clean.toLowerCase() && clean.length > 3;
      });

      if (nonCamel.length > 0) {
        findings.push({
          id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
          source: 'gate',
          category: 'accessibility',
          severity: rule.severity,
          clauseId: rule.clause,
          clauseQuote: extractClauseQuote(clause, 'CamelCase'),
          postField: 'hashtags',
          postQuote: nonCamel.join(' '),
          explanation: `Hashtags must be in CamelCase for screen-reader accessibility. Found: ${nonCamel.join(', ')}`,
          suggestedFix: nonCamel.map((h) => '#' + capitalize(h.replace('#', ''))).join(' '),
          autoFixable: true,
          confidence: 1.0,
          verified: true,
          agreement: 'deterministic',
        });
      }
      continue;
    }

    // 7. OFFER VALIDITY
    if (rule.type === 'offer_validity') {
      for (const term of rule.terms || []) {
        if (caption.toLowerCase().includes(term.toLowerCase())) {
          // Check campaign facts
          const fact = pack.facts.find((f) => f.aliases.some((a) => a.toLowerCase() === term.toLowerCase()));
          if (fact) {
            if (fact.status === 'expired' || (fact.validTo && fact.validTo < demoDate)) {
              const idx = caption.toLowerCase().indexOf(term.toLowerCase());
              findings.push({
                id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
                source: 'gate',
                category: rule.category,
                severity: rule.severity,
                clauseId: rule.clause,
                clauseQuote: extractClauseQuote(clause, term),
                postField: 'caption',
                postQuote: caption.slice(idx, idx + term.length),
                explanation: `Campaign '${term}' concluded on ${fact.validTo} and is expired relative to current date (${demoDate}).`,
                autoFixable: false,
                confidence: 1.0,
                verified: true,
                agreement: 'deterministic',
              });
            }
          }
        }
      }
      continue;
    }

    // 8. NUMERIC FACT (Shipping threshold, prices)
    if (rule.type === 'numeric_fact') {
      if (rule.pattern) {
        const regex = new RegExp(rule.pattern, 'i');
        const match = caption.match(regex);
        if (match) {
          const numVal = parseInt(match[1], 10);
          let failed = false;
          let msg = rule.message;

          if (rule.min !== undefined && numVal < rule.min) {
            failed = true;
            msg = `Found ₹${numVal}; minimum permitted is ₹${rule.min}.`;
          }
          if (rule.max !== undefined && numVal > rule.max) {
            failed = true;
            msg = `Found ₹${numVal}; expected threshold is ₹${rule.max}.`;
          }

          if (failed) {
            findings.push({
              id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
              source: 'gate',
              category: rule.category,
              severity: rule.severity,
              clauseId: rule.clause,
              clauseQuote: extractClauseQuote(clause),
              postField: 'caption',
              postQuote: match[0],
              explanation: msg,
              suggestedFix: rule.suggest?.[String(numVal)],
              autoFixable: Boolean(rule.autoFix && rule.suggest?.[String(numVal)]),
              confidence: 1.0,
              verified: true,
              agreement: 'deterministic',
            });
          }
        }
      }
      continue;
    }

    // 9. DISCLOSURE REQUIRED
    if (rule.type === 'disclosure_required') {
      let hasCollabMarker = false;
      let collabWord = '';
      for (const term of rule.terms || []) {
        const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
        const match = caption.match(regex);
        if (match) {
          hasCollabMarker = true;
          collabWord = match[0];
          break;
        }
      }

      if (hasCollabMarker) {
        const hasAdTag = caption.includes('#ad') || hashtags.some((h) => h.toLowerCase() === '#ad');
        const hasPaidFlag = Boolean(post.paidPartnership);

        if (!hasAdTag || !hasPaidFlag) {
          findings.push({
            id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
            source: 'gate',
            category: 'disclosure',
            severity: rule.severity,
            clauseId: rule.clause,
            clauseQuote: extractClauseQuote(clause, '#ad'),
            postField: 'caption',
            postQuote: collabWord,
            explanation: `Collaboration marker '${collabWord}' detected without mandatory '#ad' hashtag and paid partnership flag.`,
            autoFixable: false,
            confidence: 1.0,
            verified: true,
            agreement: 'deterministic',
          });
        }
      }
      continue;
    }

    // 10. CLAIM PATTERN
    if (rule.type === 'claim_pattern') {
      if (rule.pattern) {
        const regex = new RegExp(rule.pattern, rule.flags || 'i');
        const match = caption.match(regex);
        if (match) {
          findings.push({
            id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
            source: 'gate',
            category: rule.category,
            severity: rule.severity,
            clauseId: rule.clause,
            clauseQuote: extractClauseQuote(clause),
            postField: 'caption',
            postQuote: match[0],
            explanation: rule.message,
            autoFixable: false,
            confidence: 1.0,
            verified: true,
            agreement: 'deterministic',
          });
        }
      } else if (rule.terms) {
        for (const term of rule.terms) {
          if (caption.toLowerCase().includes(term.toLowerCase())) {
            const idx = caption.toLowerCase().indexOf(term.toLowerCase());
            findings.push({
              id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
              source: 'gate',
              category: rule.category,
              severity: rule.severity,
              clauseId: rule.clause,
              clauseQuote: extractClauseQuote(clause, term),
              postField: 'caption',
              postQuote: caption.slice(idx, idx + term.length),
              explanation: rule.message,
              autoFixable: false,
              confidence: 1.0,
              verified: true,
              agreement: 'deterministic',
            });
            break;
          }
        }
      }
      continue;
    }

    // 11. ALT TEXT
    if (rule.type === 'alt_text') {
      if (rule.clause === 'AR-001') {
        if (post.imageDataUrl && (!altText || altText.trim().length === 0)) {
          findings.push({
            id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
            source: 'gate',
            category: 'accessibility',
            severity: rule.severity,
            clauseId: rule.clause,
            clauseQuote: extractClauseQuote(clause, 'alt text'),
            postField: 'alt_text',
            postQuote: 'missing',
            explanation: rule.message,
            autoFixable: false,
            confidence: 1.0,
            verified: true,
            agreement: 'deterministic',
          });
        }
      } else if (rule.clause === 'AR-002') {
        if (altText && altText.trim().length > 0) {
          const len = altText.trim().length;
          if ((rule.min && len < rule.min) || (rule.max && len > rule.max)) {
            findings.push({
              id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
              source: 'gate',
              category: 'accessibility',
              severity: rule.severity,
              clauseId: rule.clause,
              clauseQuote: extractClauseQuote(clause, '20 and 125 characters'),
              postField: 'alt_text',
              postQuote: altText.slice(0, 30),
              explanation: `Alt text length is ${len} characters; required between ${rule.min} and ${rule.max}.`,
              autoFixable: false,
              confidence: 1.0,
              verified: true,
              agreement: 'deterministic',
            });
          }
        }
      }
      continue;
    }

    // 12. ASPECT RATIO
    if (rule.type === 'aspect_ratio' && post.imageMeta) {
      const { width, height } = post.imageMeta;
      const ratio = width / height;
      const validRatios = [
        { name: '4:5', val: 4 / 5 },
        { name: '1:1', val: 1.0 },
        { name: '9:16', val: 9 / 16 },
      ];
      const matchesAny = validRatios.some((vr) => Math.abs(ratio - vr.val) < 0.05);

      if (!matchesAny) {
        findings.push({
          id: `finding-${rule.id}-${Date.now()}-${findings.length}`,
          source: 'gate',
          category: 'visual',
          severity: rule.severity,
          clauseId: rule.clause,
          clauseQuote: extractClauseQuote(clause, 'aspect ratio'),
          postField: 'meta',
          postQuote: `${width}x${height} (${ratio.toFixed(2)})`,
          explanation: `Image dimensions ${width}x${height} do not match approved Instagram aspect ratios (4:5, 1:1, or 9:16).`,
          autoFixable: false,
          confidence: 1.0,
          verified: true,
          agreement: 'deterministic',
        });
      }
      continue;
    }
  }

  // Calculate score and gate status
  const gatesFailed = findings
    .filter((f) => f.severity === 'critical' || f.severity === 'major')
    .map((f) => f.clauseId);

  let penaltyTotal = 0;
  for (const f of findings) {
    if (f.severity === 'critical') penaltyTotal += 40;
    else if (f.severity === 'major') penaltyTotal += 15;
    else if (f.severity === 'minor') penaltyTotal += 5;
  }

  const score = Math.max(0, 100 - penaltyTotal);
  const passed = findings.every((f) => f.severity !== 'critical') && score >= 70;

  return {
    passed,
    score,
    findings,
    gatesFailed,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
