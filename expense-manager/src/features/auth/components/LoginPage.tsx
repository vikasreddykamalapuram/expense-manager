import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Shield, Cloud, Smartphone, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { AUTH_CONFIG, isGoogleConfigured, isMicrosoftConfigured, isAnyAuthConfigured } from '../../../shared/config/auth';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useMsal } from '@azure/msal-react';
import { AuthUser } from '../../../shared/types';

function decodeJwtPayload(token: string): Record<string, string> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

export function LoginPage() {
  const { login } = useAuth();
  const { instance } = useMsal();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSuccess = (response: CredentialResponse) => {
    if (!response.credential) {
      setError('Google sign-in failed. Please try again.');
      return;
    }

    const payload = decodeJwtPayload(response.credential);
    const user: AuthUser = {
      id: payload.sub || '',
      email: payload.email || '',
      name: payload.name || payload.email || 'Google User',
      avatar: payload.picture || undefined,
      provider: 'google',
    };

    login(user);
    navigate('/');

    // Store client ID for later Drive token requests (triggered on first backup attempt).
    sessionStorage.setItem('em_google_client_id', AUTH_CONFIG.google.clientId);
    // Don't request Drive token here — it opens another popup which causes
    // multi-tab issues on mobile. The backup service will request it when needed.
  };


  const handleMicrosoftLogin = async () => {
    try {
      const result = await instance.loginPopup({
        scopes: [...AUTH_CONFIG.microsoft.scopes],
      });

      if (result.account) {
        const user: AuthUser = {
          id: result.account.localAccountId,
          email: result.account.username,
          name: result.account.name || result.account.username,
          avatar: undefined,
          provider: 'microsoft',
        };
        login(user);
        navigate('/');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (!message.includes('user_cancelled')) {
        setError('Microsoft sign-in failed. Please try again.');
      }
    }
  };

  const handleSkip = () => {
    navigate('/');
  };

  const authConfigured = isAnyAuthConfigured();

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center bg-gradient-to-br from-primary-600 to-primary-800 p-12 text-white">
        <div className="max-w-md space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">ExpenseIQ</h1>
              <p className="text-primary-200 text-sm">Personal Finance Manager</p>
            </div>
          </div>

          <div className="space-y-6">
            <Feature
              icon={<Shield size={22} />}
              title="Secure & Private"
              desc="Your data stays on your device. No servers, no third-party access."
            />
            <Feature
              icon={<Cloud size={22} />}
              title="Cloud Backup"
              desc="Sign in to backup your data to Google Drive or OneDrive."
            />
            <Feature
              icon={<Smartphone size={22} />}
              title="Access Anywhere"
              desc="Sync across devices when signed in with your account."
            />
          </div>

          <div className="mt-8 rounded-xl bg-white/10 backdrop-blur-sm p-4">
            <p className="text-sm text-primary-100">
              <strong className="text-white">Privacy first:</strong> ExpenseIQ works entirely offline.
              Sign-in is optional and only used for cloud backup.
            </p>
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex flex-1 flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ExpenseIQ</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Personal Finance Manager</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sign in to enable cloud backup, or continue without an account.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-danger-50 border border-danger-200 p-3 text-sm text-danger-700">
              <AlertCircle size={16} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* SSO Buttons */}
          <div className="space-y-3">
            {/* Google */}
            {isGoogleConfigured() ? (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-in failed.')}
                  theme="outline"
                  size="large"
                  width="340"
                  text="continue_with"
                  ux_mode="popup"
                />
              </div>
            ) : (
              <button
                disabled
                className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed"
              >
                <GoogleIcon />
                Continue with Google
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">Not configured</span>
              </button>
            )}

            {/* Microsoft */}
            {isMicrosoftConfigured() ? (
              <button
                onClick={handleMicrosoftLogin}
                className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md active:scale-[0.98]"
              >
                <MicrosoftIcon />
                Continue with Microsoft
              </button>
            ) : (
              <button
                disabled
                className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed"
              >
                <MicrosoftIcon />
                Continue with Microsoft
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">Not configured</span>
              </button>
            )}
          </div>

          {!authConfigured && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-700">
                <strong>Setup required:</strong> To enable SSO, add your OAuth client IDs to{' '}
                <code className="bg-amber-100 px-1 rounded">.env</code> file:
              </p>
              <pre className="mt-2 text-[11px] text-amber-600 bg-amber-100/50 rounded p-2 overflow-x-auto">
{`VITE_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
VITE_MICROSOFT_CLIENT_ID=your-azure-app-client-id`}
              </pre>
            </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-gray-800 px-4 text-gray-400 dark:text-gray-500 uppercase tracking-wider">or</span>
            </div>
          </div>

          {/* Skip / Continue without account */}
          <button
            onClick={handleSkip}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-100 px-4 py-3 text-sm font-medium text-white dark:text-gray-900 shadow-sm transition-all hover:bg-gray-800 dark:hover:bg-gray-200 active:scale-[0.98]"
          >
            Continue without account
            <ArrowRight size={16} />
          </button>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Your data is always stored locally. Sign-in only enables cloud backup.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-primary-200">{desc}</p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}
