import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '@/firebase/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E2E5EA] shadow-sm p-8">
          {/* Logo / Monogram */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#1B3A6B] flex items-center justify-center mb-4">
              <span
                className="text-white text-2xl font-bold"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                SMP
              </span>
            </div>
            <h1
              className="text-2xl text-[#111827] text-center leading-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Sanjay Memorial Polytechnic
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">Staff Management Portal</p>
          </div>

          {/* Form */}
          <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@smp.edu.in"
                className="w-full px-3 py-2.5 text-sm rounded-md border border-[#E2E5EA] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3 py-2.5 text-sm rounded-md border border-[#E2E5EA] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
              />
            </div>

            {error && (
              <div className="px-3 py-2 rounded-md bg-[#FEE2E2] border border-[#FECACA] text-sm text-[#DC2626]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 px-4 rounded-md bg-[#1B3A6B] text-white text-sm font-medium hover:bg-[#142D55] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#9CA3AF] mt-6">
          Contact your administrator to get access.
        </p>
      </div>
    </div>
  );
}
