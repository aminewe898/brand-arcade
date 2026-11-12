// Brand registry. Add a new customer here.
// This file is also imported by vite.config.js and tools/, so brand files must stay
// pure data (no browser APIs, no asset imports).
import solmara from './solmara.js';
import lumbre from './lumbre.js';

export const brands = { solmara, lumbre };
export const DEFAULT_BRAND = 'solmara';

/** Resolve a localised field: string | { es, en } → string */
export function loc(value, lang) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.es ?? value.en ?? Object.values(value)[0] ?? '';
}
