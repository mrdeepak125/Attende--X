import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState('');
  const navigate = useNavigate();
  const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:5000/api/auth';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch(`${AUTH_URL}/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to send reset link');
        return;
      }
      setSent(true);
    } catch (err) {
      console.error(err);
      setError('Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <Link to="/login" className="inline-flex items-center gap-2 text-zinc-500 hover:text-indigo-600 transition-colors mb-6">
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Login</span>
          </Link>

          {sent ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-green-600" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-3">Check Your Email</h2>
              <p className="text-zinc-500 text-sm mb-6">
                We've sent a password reset link to<br />
                <span className="text-zinc-900 font-semibold">{email}</span>
              </p>
              <p className="text-xs text-zinc-400 mb-6">The link expires in 15 minutes. Check your spam folder if you don't see it.</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all"
              >
                Back to Login
              </button>
            </motion.div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-zinc-900 mb-2">Reset Password</h1>
                <p className="text-zinc-500 text-sm">Enter your email and we'll send you a reset link</p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                      required type="email" placeholder="john@example.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 group"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                  {!loading && <Send size={18} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}