// The palette is stored by key, never by hex, so the same note renders with
// light-mode paper colours and muted dark-mode ones without any migration.
export const NOTE_COLORS = [
  { key: 'butter', name: 'Butter' },
  { key: 'apricot', name: 'Apricot' },
  { key: 'rose', name: 'Rose' },
  { key: 'lilac', name: 'Lilac' },
  { key: 'sky', name: 'Sky' },
  { key: 'mint', name: 'Mint' },
  { key: 'sand', name: 'Sand' },
  { key: 'slate', name: 'Slate' },
];

export const DEFAULT_COLOR = 'butter';

const KEYS = new Set(NOTE_COLORS.map((c) => c.key));

export function isColor(key) {
  return KEYS.has(key);
}

export function colorName(key) {
  return NOTE_COLORS.find((c) => c.key === key)?.name ?? 'Butter';
}
