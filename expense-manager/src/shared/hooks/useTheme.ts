import { useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Settings, AccentColor, DarkMode } from '../types';

type ThemeMode = Settings['theme'];
type EffectiveTheme = 'light' | 'dark';

export function useTheme() {
  const { state, actions } = useAppContext();
  const theme = state.settings.theme;
  const accentColor = state.settings.accentColor ?? 'blue';
  const darkMode = state.settings.darkMode ?? 'default';

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

  // Apply accent color data attribute
  useEffect(() => {
    const root = document.documentElement;
    if (accentColor && accentColor !== 'blue') {
      root.setAttribute('data-accent', accentColor);
    } else {
      root.removeAttribute('data-accent');
    }
  }, [accentColor]);

  // Apply dark mode style data attribute
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode === 'black') {
      root.setAttribute('data-dark-mode', 'black');
    } else {
      root.removeAttribute('data-dark-mode');
    }
  }, [darkMode]);

  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      actions.updateSettings({ theme: newTheme });
    },
    [actions]
  );

  const setAccentColor = useCallback(
    (color: AccentColor) => {
      actions.updateSettings({ accentColor: color });
    },
    [actions]
  );

  const setDarkMode = useCallback(
    (mode: DarkMode) => {
      actions.updateSettings({ darkMode: mode });
    },
    [actions]
  );

  return { theme, effectiveTheme, setTheme, accentColor, setAccentColor, darkMode, setDarkMode };
}
