import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../lib/api/auth.api';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/Button';

export function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDemo(role: 'manager' | 'hr' | 'candidate') {
    setLoading(true); setError('');
    try {
      const { token, user } = await authApi.demoLogin(role);
      login(token, user as any);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Demo login failed. Is the server running?');
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-culture-gray">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-power-orange text-lg font-bold text-white">T</span>
          <div>
            <p className="font-display font-semibold text-network-blue">TalentLens AI</p>
            <p className="text-xs text-[var(--fg-3)]">Internal Staffing Platform</p>
          </div>
        </div>

        <h1 className="mb-6 text-xl font-semibold text-network-blue">Sign in</h1>

        {error && <p className="mb-4 rounded-lg bg-power-orange/10 p-3 text-sm text-power-orange">{error}</p>}

        {/* Demo logins */}
        <div className="space-y-2">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--fg-3)]">Demo accounts</p>
          {(['manager', 'hr', 'candidate'] as const).map(role => (
            <Button
              key={role}
              variant="secondary"
              className="w-full capitalize"
              disabled={loading}
              onClick={() => handleDemo(role)}
            >
              Login as {role}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
