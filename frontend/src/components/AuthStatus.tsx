import { useEffect, useState } from 'react';
import { getAuthStatus, getAuthLoginUrl, logout } from '../api/client';
import type { AuthStatus as AuthStatusType } from '../types';

interface Props {
  onAuthChange?: (authenticated: boolean) => void;
}

export default function AuthStatus({ onAuthChange }: Props) {
  const [status, setStatus] = useState<AuthStatusType | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    setLoading(true);
    try {
      const s = await getAuthStatus();
      setStatus(s);
      onAuthChange?.(s.authenticated);
    } catch {
      setStatus({ authenticated: false });
      onAuthChange?.(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    // Check for auth callback params
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth') || params.has('auth_error')) {
      window.history.replaceState({}, '', '/');
      checkAuth();
    }
  }, []);

  const handleLogin = async () => {
    try {
      const url = await getAuthLoginUrl();
      window.location.href = url;
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start login');
    }
  };

  const handleLogout = async () => {
    await logout();
    setStatus({ authenticated: false });
    onAuthChange?.(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
        Checking auth...
      </div>
    );
  }

  if (!status?.authenticated) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-sm text-gray-300">Not connected</span>
        <button
          onClick={handleLogin}
          className="ml-auto px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
        >
          Connect Gmail
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
      <div className="w-2 h-2 rounded-full bg-green-500" />
      <span className="text-sm text-gray-300 truncate">{status.email}</span>
      <button
        onClick={handleLogout}
        className="ml-auto px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-md transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
