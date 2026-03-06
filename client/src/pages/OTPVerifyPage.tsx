import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, RefreshCw, Mail } from 'lucide-react';
import { motion } from 'motion/react';

export default function OTPVerifyPage() {
  const [otp, setOtp]             = useState(['', '', '', '']);
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState('');
  const [info, setInfo]           = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate  = useNavigate();
  const location  = useLocation();

  const email  = location.state?.email  || '';
  const action = location.state?.action || 'signup';
  const resent = location.state?.resent || false; // true when unverified account was re-activated
  const AUTH_URL = (import.meta as any).env?.VITE_AUTH_URL || 'http://localhost:5000/api/auth';

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-focus first input on mount
  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  // If redirected from re-signup of unverified account, show a friendly info message
  useEffect(() => {
    if (resent) {
      setInfo('Your account already existed but wasn\'t verified. A fresh code has been sent to your email.');
    }
  }, [resent]);

  // ── Redirect guard: if no email passed, go back to register/login ──
  useEffect(() => {
    if (!email) {
      navigate(action === 'reset' ? '/forgot-password' : '/register', { replace: true });
    }
  }, [email]);

  const handleChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned && value) return;

    // Paste of full 4-digit code
    if (cleaned.length >= 4) {
      const digits = cleaned.slice(0, 4).split('');
      setOtp(digits);
      inputRefs.current[3]?.focus();
      return;
    }

    const char = cleaned.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);
    if (char && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const n = [...otp]; n[index] = ''; setOtp(n);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
    // Allow Ctrl+V / Cmd+V paste — the onChange will pick it up
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.some(d => !d)) return;
    setError(''); setInfo('');
    setLoading(true);

    try {
      const code = otp.join('');
      const res  = await fetch(`${AUTH_URL}/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, otp: code, action })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Verification failed. Please try again.');
        return;
      }

      if (action === 'signup') {
        if (data.token)    localStorage.setItem('token',     data.token);
        if (data.userType) localStorage.setItem('userType',  data.userType);
        if (data.username) localStorage.setItem('userName',  data.username);
        if (data.email)    localStorage.setItem('userEmail', data.email);

        if (data.userType === 'teacher') navigate('/dashboard',  { replace: true });
        else                             navigate('/join-room',   { replace: true });
      } else {
        navigate('/reset-password', { state: { email, otp: code } });
      }
    } catch {
      setError('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError(''); setInfo('');
    try {
      const res  = await fetch(`${AUTH_URL}/resend-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to resend code.');
        return;
      }
      setOtp(['', '', '', '']);
      inputRefs.current[0]?.focus();
      setCountdown(60);
      setInfo('A new code has been sent to your email.');
    } catch {
      setError('Server error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <Link
            to={action === 'reset' ? '/forgot-password' : '/register'}
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-indigo-600 transition-colors mb-6"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back</span>
          </Link>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="text-indigo-600" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">Verify Email</h1>
            <p className="text-zinc-500 text-sm">
              We sent a 4-digit code to<br />
              <span className="text-zinc-800 font-semibold">{email}</span>
            </p>
          </div>

          {/* Info banner (non-error) */}
          {info && (
            <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-start gap-2">
              <Mail size={16} className="mt-0.5 flex-shrink-0" />
              <span>{info}</span>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* OTP inputs */}
            <div className="flex justify-center gap-3">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}           /* allow 4 to detect paste */
                  value={digit}
                  onChange={e => handleChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  className={`w-14 h-16 text-center text-2xl font-bold bg-zinc-50 border-2 rounded-xl outline-none transition-all ${
                    digit
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-zinc-200 text-zinc-900'
                  } focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10`}
                  placeholder="·"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={otp.some(d => !d) || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all"
            >
              {loading ? 'Verifying…' : 'Verify Code'}
            </button>

            <div className="text-center space-y-2">
              <p className="text-sm text-zinc-500">Didn't receive the code?</p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || countdown > 0}
                className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-sm hover:underline disabled:text-zinc-400 disabled:no-underline disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
                {countdown > 0 ? `Resend in ${countdown}s` : resending ? 'Sending…' : 'Resend Code'}
              </button>
              <p className="text-xs text-zinc-400 pt-1">
                Check spam/junk folder. Code expires in 5 minutes.
              </p>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}