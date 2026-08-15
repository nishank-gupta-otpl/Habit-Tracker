// Cosmetic unlocks — themes earned by levelling up.
//
// Each theme is a set of CSS custom properties applied to <html>. Tailwind
// reads them through the arbitrary-value syntax in index.css, so switching
// themes is a single attribute change with no re-render cost.

export const THEMES = [
  {
    key: 'nebula',
    name: 'Nebula',
    unlockLevel: 1,
    emoji: '🌌',
    swatch: ['#7c3aed', '#06b6d4', '#f472b6'],
    vars: {
      '--bg': '#0b0a1f',
      '--surface': '#171436',
      '--surface-2': '#211c4d',
      '--border': '#332c6b',
      '--text': '#f4f2ff',
      '--muted': '#a49dd6',
      '--primary': '#8b5cf6',
      '--primary-soft': '#a78bfa',
      '--accent': '#22d3ee',
      '--success': '#34d399',
      '--warning': '#fbbf24',
      '--danger': '#fb7185',
      '--glow': '139 92 246',
    },
  },
  {
    key: 'sunset',
    name: 'Sunset Run',
    unlockLevel: 3,
    emoji: '🌇',
    swatch: ['#f97316', '#ec4899', '#facc15'],
    vars: {
      '--bg': '#1c0f1a',
      '--surface': '#2b1526',
      '--surface-2': '#3b1c31',
      '--border': '#552843',
      '--text': '#fff5f0',
      '--muted': '#e0a9bd',
      '--primary': '#f97316',
      '--primary-soft': '#fb923c',
      '--accent': '#ec4899',
      '--success': '#4ade80',
      '--warning': '#facc15',
      '--danger': '#ef4444',
      '--glow': '249 115 22',
    },
  },
  {
    key: 'forest',
    name: 'Deep Forest',
    unlockLevel: 6,
    emoji: '🌲',
    swatch: ['#10b981', '#84cc16', '#0ea5e9'],
    vars: {
      '--bg': '#07160f',
      '--surface': '#0e2419',
      '--surface-2': '#143324',
      '--border': '#1f4d36',
      '--text': '#effaf3',
      '--muted': '#93c5ad',
      '--primary': '#10b981',
      '--primary-soft': '#34d399',
      '--accent': '#84cc16',
      '--success': '#4ade80',
      '--warning': '#fbbf24',
      '--danger': '#f87171',
      '--glow': '16 185 129',
    },
  },
  {
    key: 'arcade',
    name: 'Arcade',
    unlockLevel: 10,
    emoji: '👾',
    swatch: ['#f0f', '#0ff', '#ff0'],
    vars: {
      '--bg': '#08040f',
      '--surface': '#150a24',
      '--surface-2': '#20103a',
      '--border': '#3b1d63',
      '--text': '#f7f0ff',
      '--muted': '#c4a5f5',
      '--primary': '#ff00e5',
      '--primary-soft': '#ff5cf0',
      '--accent': '#00fff2',
      '--success': '#39ff14',
      '--warning': '#ffe600',
      '--danger': '#ff3860',
      '--glow': '255 0 229',
    },
  },
  {
    key: 'gold',
    name: 'Gold Rush',
    unlockLevel: 15,
    emoji: '🏆',
    swatch: ['#fbbf24', '#f59e0b', '#fde68a'],
    vars: {
      '--bg': '#141005',
      '--surface': '#221a08',
      '--surface-2': '#30250c',
      '--border': '#4d3a12',
      '--text': '#fffaf0',
      '--muted': '#d6c08a',
      '--primary': '#f59e0b',
      '--primary-soft': '#fbbf24',
      '--accent': '#fde68a',
      '--success': '#84cc16',
      '--warning': '#fb923c',
      '--danger': '#ef4444',
      '--glow': '245 158 11',
    },
  },
  {
    key: 'ice',
    name: 'Glacier',
    unlockLevel: 22,
    emoji: '🧊',
    swatch: ['#38bdf8', '#818cf8', '#e0f2fe'],
    vars: {
      '--bg': '#050f1c',
      '--surface': '#0a1c31',
      '--surface-2': '#0f2947',
      '--border': '#1c3f66',
      '--text': '#f0f9ff',
      '--muted': '#93c5fd',
      '--primary': '#38bdf8',
      '--primary-soft': '#7dd3fc',
      '--accent': '#818cf8',
      '--success': '#2dd4bf',
      '--warning': '#fbbf24',
      '--danger': '#fb7185',
      '--glow': '56 189 248',
    },
  },
  {
    key: 'void',
    name: 'Void Walker',
    unlockLevel: 30,
    emoji: '🕳️',
    swatch: ['#a855f7', '#6366f1', '#111827'],
    vars: {
      '--bg': '#000000',
      '--surface': '#0c0c12',
      '--surface-2': '#15151f',
      '--border': '#2a2a3d',
      '--text': '#ffffff',
      '--muted': '#8b8ba7',
      '--primary': '#a855f7',
      '--primary-soft': '#c084fc',
      '--accent': '#6366f1',
      '--success': '#22c55e',
      '--warning': '#eab308',
      '--danger': '#ef4444',
      '--glow': '168 85 247',
    },
  },
];

export const THEMES_BY_KEY = Object.fromEntries(THEMES.map((t) => [t.key, t]));

export const themesForLevel = (level) => THEMES.filter((t) => t.unlockLevel <= level);

export const isThemeUnlocked = (key, level) => (THEMES_BY_KEY[key]?.unlockLevel ?? 99) <= level;

/** Paint a theme onto the document root. */
export function applyTheme(key) {
  const theme = THEMES_BY_KEY[key] || THEMES_BY_KEY.nebula;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([prop, value]) => root.style.setProperty(prop, value));
  root.dataset.theme = theme.key;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.vars['--bg']);
}

/** Card accent colours, kept separate from themes so habits stay distinct. */
export const CARD_COLORS = {
  violet: { from: '#8b5cf6', to: '#6366f1' },
  cyan: { from: '#22d3ee', to: '#0ea5e9' },
  emerald: { from: '#34d399', to: '#10b981' },
  amber: { from: '#fbbf24', to: '#f59e0b' },
  rose: { from: '#fb7185', to: '#e11d48' },
  fuchsia: { from: '#e879f9', to: '#c026d3' },
  lime: { from: '#a3e635', to: '#65a30d' },
  orange: { from: '#fb923c', to: '#ea580c' },
};

export const CARD_COLOR_KEYS = Object.keys(CARD_COLORS);

export const cardGradient = (color) => {
  const c = CARD_COLORS[color] || CARD_COLORS.violet;
  return `linear-gradient(135deg, ${c.from}, ${c.to})`;
};
