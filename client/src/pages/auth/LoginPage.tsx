import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/Feedback';
import { authApi, type JwtUser } from '../../lib/api/auth.api';
import { cn } from '../../lib/utils/cn';

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm({ onSuccess }: { onSuccess: (token: string, user: JwtUser) => void }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [show,     setShow]     = useState(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess:  ({ token, user }) => onSuccess(token, user),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutate(); }} className="space-y-4">
      {error && <ErrorBanner message={(error as any)?.response?.data?.message ?? 'Login failed'} />}
      <div>
        <label className="mb-1 block text-sm font-medium text-secure-gray">Work email</label>
        <input
          type="email" required value={email} onChange={e => setEmail(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-celestial-blue focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-secure-gray">Password</label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'} required value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 pr-9 text-sm focus:border-celestial-blue focus:outline-none"
          />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-2.5 top-2.5 text-[var(--fg-3)]">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <a href="#" className="mt-1 block text-right text-xs text-celestial-blue hover:underline">Forgot password?</a>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 size={16} className="animate-spin" /> : 'Log in'}
      </Button>
    </form>
  );
}

// ─── Sign-up form ─────────────────────────────────────────────────────────────

function SignupForm({ onSuccess }: { onSuccess: (token: string, user: JwtUser) => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'manager' as const, terms: false });
  const [validErr, setValidErr] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => authApi.signup({ name: form.name, email: form.email, password: form.password, role: form.role }),
    onSuccess:  ({ token, user }) => onSuccess(token, user),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidErr('');
    if (form.password !== form.confirm) return setValidErr('Passwords do not match');
    if (!form.terms) return setValidErr('You must agree to the terms');
    mutate();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(validErr || error) && <ErrorBanner message={validErr || (error as any)?.response?.data?.message} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-secure-gray">Full name</label>
          <input required value={form.name} onChange={set('name')}
            className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-celestial-blue focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-secure-gray">Role</label>
          <select value={form.role} onChange={set('role')}
            className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-celestial-blue focus:outline-none">
            <option value="manager">Manager</option>
            <option value="hr">HR</option>
            <option value="candidate">Candidate</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-secure-gray">Work email</label>
        <input type="email" required value={form.email} onChange={set('email')}
          className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-celestial-blue focus:outline-none" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-secure-gray">Password</label>
          <input type="password" required minLength={8} value={form.password} onChange={set('password')}
            className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-celestial-blue focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-secure-gray">Confirm password</label>
          <input type="password" required value={form.confirm} onChange={set('confirm')}
            className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-celestial-blue focus:outline-none" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-secure-gray">
        <input type="checkbox" checked={form.terms} onChange={set('terms')} className="rounded" />
        I agree to the terms of service
      </label>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 size={16} className="animate-spin" /> : 'Create account'}
      </Button>
    </form>
  );
}

// ─── Demo login block ─────────────────────────────────────────────────────────

function DemoBlock({ onSuccess }: { onSuccess: (token: string, user: JwtUser) => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState('');

  async function handleDemo(role: 'manager' | 'hr' | 'candidate') {
    setLoading(role); setError('');
    try {
      const { token, user } = await authApi.demoLogin(role);
      onSuccess(token, user);
    } catch {
      setError('Demo login failed. Is the server running?');
    } finally { setLoading(null); }
  }

  return (
    <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-culture-gray p-4">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-3)]">
        Demo login (judging only)
      </p>
      {error && <p className="mb-2 text-center text-xs text-power-orange">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        {(['manager', 'hr', 'candidate'] as const).map(role => (
          <Button key={role} variant="secondary" size="sm"
            disabled={loading !== null} onClick={() => handleDemo(role)}
            className="flex items-center justify-center gap-1 capitalize">
            {loading === role ? <Loader2 size={12} className="animate-spin" /> : null}
            {role}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const { login }     = useAuth();
  const navigate      = useNavigate();

  function handleSuccess(token: string, user: JwtUser) {
    login(token, user);
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-culture-gray p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-power-orange text-lg font-bold text-white">T</span>
          <div>
            <p className="font-display font-semibold text-network-blue">TalentLens AI</p>
            <p className="text-xs text-[var(--fg-3)]">Internal Staffing Platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl bg-white p-6 shadow-md">
          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-lg bg-culture-gray p-1">
            {(['login', 'signup'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition-colors',
                  tab === t ? 'bg-white text-network-blue shadow-xs' : 'text-[var(--fg-3)] hover:text-secure-gray')}>
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>
          {tab === 'login'
            ? <LoginForm  onSuccess={handleSuccess} />
            : <SignupForm onSuccess={handleSuccess} />}
        </div>

        <DemoBlock onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
