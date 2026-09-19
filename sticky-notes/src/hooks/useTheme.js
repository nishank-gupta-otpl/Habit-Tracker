import { useCallback, useEffect, useState } from 'react';

const KEY = 'sticky-notes:theme';
export const THEMES = ['system', 'light', 'dark'];

function read() {
  try {
    const stored = localStorage.getItem(KEY);
    return THEMES.includes(stored) ? stored : 'system';
  } catch {
    // Private mode can throw on access, not just on write.
    return 'system';
  }
}

/**
 * Theme preference, defaulting to the phone's own setting. Kept in
 * localStorage rather than IndexedDB so it applies on the very first paint
 * without waiting for the database to open.
 */
export function useTheme() {
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      // Colours the Android status bar to match the board.
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#161513' : '#f5f1e8');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const update = useCallback((next) => {
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not being able to remember the choice is not worth an error.
    }
  }, []);

  return [theme, update];
}
