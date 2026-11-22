import { useThemeContext } from '../contexts/ThemeContext';

export type Theme = 'light' | 'dark' | 'system';

/**
 * useTheme
 *
 * Backwards-compatible hook that exposes the consolidated theme context.
 * The theme state, persistence (localStorage) and DOM attribute syncing
 * are handled by `ThemeProvider` / `ThemeContext`. This hook simply
 * re-exports the same `{ theme, setTheme, toggleTheme }` shape that
 * existing consumers rely on.
 *
 * Must be used within a `ThemeProvider`.
 */
export function useTheme() {
  const { theme, setTheme, toggleTheme } = useThemeContext();

  return { theme, setTheme, toggleTheme };
}
