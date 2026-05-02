import { useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Settings } from '../types';

type ThemeMode = Settings['theme'];
type EffectiveTheme = 'light' | 'dark';

export function useTheme() {
  const { state, actions } = useAppContext();
  const theme = state.settings.theme;

  const effectiveTheme: EffectiveTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }, [theme]);

  // Apply dark class to <html> and listen for OS changes when in system mode
  useEffect(() => {
    const apply = (t: EffectiveTheme) => {
      const root = document.documentElement;
      if (t === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light');
      apply(mql.matches ? 'dark' : 'light');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }

    apply(theme);
  }, [theme]);

  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      actions.updateSettings({ theme: newTheme });
    },
    [actions]
  );

  return { theme, effectiveTheme, setTheme };
}
