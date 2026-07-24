/**
 * Global keyboard shortcuts for power users.
 *
 * Shortcuts:
 *   N — New transaction (navigate to /add)
 *   S or / — Focus search (future: command palette)
 *   Escape — Close modals/menus (handled by Modal component)
 *   D — Go to Dashboard
 *   T — Go to Transactions
 *   A — Go to Analytics
 *
 * Shortcuts are disabled when:
 *   - Focus is inside an input/textarea/select
 *   - A modal is open (detected by [role="dialog"] in DOM)
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input, textarea, select, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Skip if a modal is open
      if (document.querySelector('[role="dialog"]')) return;

      // Skip if modifier keys are held (Ctrl/Cmd/Alt)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          navigate('/add');
          break;
        case 'd':
          e.preventDefault();
          navigate('/');
          break;
        case 't':
          e.preventDefault();
          navigate('/transactions');
          break;
        case 'a':
          e.preventDefault();
          navigate('/analytics');
          break;
        case 'b':
          e.preventDefault();
          navigate('/budgets');
          break;
        case 'p':
          e.preventDefault();
          navigate('/portfolio');
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);
}
