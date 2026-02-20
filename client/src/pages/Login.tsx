import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { api } from '../utils/api';

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    
    if (!formData.password) newErrors.password = 'Password is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await api.login({ email: formData.email, password: formData.password });
      console.log('login res', res);
      // store token if provided
      if (res?.token) localStorage.setItem('token', res.token);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setErrors({ form: 'Invalid credentials' });
    }
    setIsLoading(false);
  };

  return (
    <AuthLayout 
      title="Welcome back" 
      subtitle="Please enter your details to sign in"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
          <input
            type="email"
            className={`w-full px-4 py-2.5 rounded-xl border ${errors.email ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'} outline-none transition-all duration-200`}
            placeholder="name@company.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          {errors.email && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.email}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <Link to="/forgot-password" title="Reset your password" id="forgot-password-link" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className={`w-full px-4 py-2.5 rounded-xl border ${errors.password ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'} outline-none transition-all duration-200`}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.password}</p>}
        </div>

        <div className="flex items-center">
          <input
            id="remember-me"
            type="checkbox"
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
            checked={formData.rememberMe}
            onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
          />
          <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 cursor-pointer select-none">
            Remember me for 30 days
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>

        <p className="text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link to="/signup" className="font-bold text-indigo-600 hover:text-indigo-700">
            Create account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
