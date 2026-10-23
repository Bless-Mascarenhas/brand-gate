import { Category, Clause, PolicyPack } from '@/src/types';

export const CATEGORY_DOC_MAP: Record<Category, string[]> = {
  tone: ['BV'],
  terminology: ['TM'],
  messaging: ['BV', 'SR'],
  claims: ['CL', 'AF'],
  factual_accuracy: ['AF'],
  visual: ['VI'],
  accessibility: ['AR'],
  disclosure: ['SR', 'CL'],
  regional: ['TM', 'SR', 'AF'],
  security: ['EM'],
};

export function getRoutedClauses(category: Category, pack: PolicyPack): Clause[] {
  const allowedPrefixes = CATEGORY_DOC_MAP[category] || ['BV'];
  return pack.clauses.filter((clause) => {
    const prefix = clause.id.split('-')[0];
    return allowedPrefixes.includes(prefix);
  });
}

export function getRoutedClausesForCategories(categories: Category[], pack: PolicyPack): Clause[] {
  const allPrefixes = new Set<string>();
  for (const cat of categories) {
    const prefixes = CATEGORY_DOC_MAP[cat] || [];
    prefixes.forEach((p) => allPrefixes.add(p));
  }
  return pack.clauses.filter((clause) => {
    const prefix = clause.id.split('-')[0];
    return allPrefixes.has(prefix);
  });
}
