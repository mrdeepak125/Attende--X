import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { api } from '../utils/api';

export default function OTPVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || 'your email';
  const isSignup = location.state?.isSignup || false;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [error, setError] = useState('');
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await api.verifyOtp({ email, otp: code });
      console.log('verifyOtp res', res);
      // If signup flow, go to dashboard. Otherwise, go to reset password
      if (isSignup) {
        navigate('/dashboard');
      } else {
        navigate('/reset-password', { state: { email, otp: code } });
      }
    } catch (err) {
      console.error(err);
      setError('Invalid or expired code');
    }
    setIsLoading(false);
  };

  const handleResend = () => {
    if (timer === 0) {
      setTimer(30);
      api.signup({ email }).catch(() => {}); // trigger resend endpoint if available
    }
  };

  return (
    <AuthLayout 
      title="Verify your email" 
      subtitle={`We've sent a code to ${email}`}
    >
      <div className="space-y-8">
        <div className="flex justify-between gap-2">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className={`w-12 h-14 text-center text-xl font-bold rounded-xl border ${error ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'} outline-none transition-all duration-200`}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
            />
          ))}
        </div>

        {error && <p className="text-center text-xs text-red-500 font-medium">{error}</p>}

        <button
          onClick={handleVerify}
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Verifying...
            </>
          ) : (
            <>
              <ShieldCheck size={20} />
              Verify Code
            </>
          )}
        </button>

        <div className="text-center">
          <p className="text-sm text-slate-500">
            Didn't receive the code?{' '}
            <button
              onClick={handleResend}
              disabled={timer > 0}
              className={`font-bold transition-colors ${timer > 0 ? 'text-slate-300 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-700'}`}
            >
              Resend {timer > 0 && `(${timer}s)`}
            </button>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
