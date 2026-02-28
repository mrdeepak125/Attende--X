import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const navigate      = useNavigate();
  const location      = useLocation();
  const [searchParams] = useSearchParams();
  const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:5000/api/auth';

  // Two flows:
  // 1. Link-based: /reset-password?token=xxx&email=yyy
  // 2. OTP-based:  navigate('/reset-password', { state: { email, otp } })
  const tokenFromUrl = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');
  const stateEmail   = location.state?.email;
  const stateOtp     = location.state?.otp;

  const email = emailFromUrl || stateEmail || '';
  const token = tokenFromUrl || null;
  const otp   = stateOtp || null;

  // Validate token if link-based
  useEffect(() => {
    if (!token || !email) { setTokenValid(!token); return; }
    fetch(`${AUTH_URL}/verify-reset-token?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => setTokenValid(d.message === 'Token valid'))
      .catch(() => setTokenValid(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const body: Record<string, string> = { email, newPassword: password };
      if (token) body.token = token;
      if (otp)   body.otp   = otp;

      const res  = await fetch(`${AUTH_URL}/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) { setError(data.message || 'Reset failed'); return; }
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch {
      setError('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Token invalid
  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-red-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Link Expired</h2>
          <p className="text-zinc-500 text-sm mb-6">This password reset link has expired or is invalid. Please request a new one.</p>
          <button onClick={() => navigate('/forgot-password')} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all">
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          {done ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-green-600" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-3">Password Reset!</h2>
              <p className="text-zinc-500 text-sm mb-2">Your password has been updated successfully.</p>
              <p className="text-zinc-400 text-xs">Redirecting you to login…</p>
            </motion.div>
          ) : (
            <>
              <Link to="/login" className="inline-flex items-center gap-2 text-zinc-500 hover:text-indigo-600 transition-colors mb-6">
                <ArrowLeft size={18} />
                <span className="text-sm font-medium">Back to Login</span>
              </Link>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="text-indigo-600" size={32} />
                </div>
                <h1 className="text-3xl font-bold text-zinc-900 mb-2">New Password</h1>
                <p className="text-zinc-500 text-sm">Create a strong password for your account</p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider ml-1">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                      required type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters"
                      value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                      required type="password" placeholder="Repeat password"
                      value={confirm} onChange={e => setConfirm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Strength indicator */}
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                          password.length >= i * 3
                            ? i <= 1 ? 'bg-red-400' : i <= 2 ? 'bg-yellow-400' : i <= 3 ? 'bg-blue-400' : 'bg-green-400'
                            : 'bg-zinc-200'
                        }`} />
                      ))}
                    </div>
                    <p className="text-xs text-zinc-400 ml-1">
                      {password.length < 4 ? 'Too short' : password.length < 7 ? 'Weak' : password.length < 10 ? 'Good' : 'Strong'}
                    </p>
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all mt-2"
                >
                  {loading ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}