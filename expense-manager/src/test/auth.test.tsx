import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AuthUser } from '../shared/types';

const AUTH_STORAGE_KEY = 'em_auth_user';

const mockUser: AuthUser = {
  id: 'test-123',
  email: 'test@example.com',
  name: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  provider: 'google',
};

// Helper component that exposes auth state for testing
function AuthTestConsumer() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="user-name">{user?.name || 'none'}</div>
      <div data-testid="user-email">{user?.email || 'none'}</div>
      <button data-testid="login-btn" onClick={() => login(mockUser)}>Login</button>
      <button data-testid="logout-btn" onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('starts as not authenticated when no stored data', async () => {
    render(
      <AuthProvider>
        <AuthTestConsumer />
      </AuthProvider>
    );

    // Wait for useEffect to complete
    expect(await screen.findByTestId('loading')).toHaveTextContent('ready');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
    expect(screen.getByTestId('user-name')).toHaveTextContent('none');
  });

  it('persists auth state to localStorage on login', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <AuthTestConsumer />
      </AuthProvider>
    );

    await screen.findByText('ready');
    await user.click(screen.getByTestId('login-btn'));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');

    // Verify localStorage was set
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.email).toBe('test@example.com');
    expect(parsed.provider).toBe('google');
  });

  it('restores auth state from localStorage on mount', async () => {
    // Pre-set localStorage
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <AuthTestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('loading')).toHaveTextContent('ready');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });

  it('migrates from sessionStorage to localStorage on mount', async () => {
    // Simulate old data in sessionStorage
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <AuthTestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('loading')).toHaveTextContent('ready');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');

    // Should have migrated to localStorage
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
    // Should have cleared sessionStorage
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('clears localStorage and OAuth tokens on logout', async () => {
    const user = userEvent.setup();
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
    sessionStorage.setItem('em_google_access_token', 'fake-token');
    sessionStorage.setItem('em_microsoft_access_token', 'fake-ms-token');

    render(
      <AuthProvider>
        <AuthTestConsumer />
      </AuthProvider>
    );

    await screen.findByText('ready');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');

    await user.click(screen.getByTestId('logout-btn'));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem('em_google_access_token')).toBeNull();
    expect(sessionStorage.getItem('em_microsoft_access_token')).toBeNull();
  });

  it('handles corrupted localStorage gracefully', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, 'not-valid-json');

    render(
      <AuthProvider>
        <AuthTestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('loading')).toHaveTextContent('ready');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
    // Should have cleared the corrupted data
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('prefers localStorage over sessionStorage when both exist', async () => {
    const localUser = { ...mockUser, name: 'Local User' };
    const sessionUser = { ...mockUser, name: 'Session User' };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(localUser));
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));

    render(
      <AuthProvider>
        <AuthTestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('loading')).toHaveTextContent('ready');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Local User');
  });
});
