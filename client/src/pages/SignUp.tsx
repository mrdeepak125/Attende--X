import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { api } from '../utils/api';

export default function SignUp() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Student',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName) newErrors.fullName = 'Full name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      };
      const res = await api.signup(payload);
      console.log('Signup response', res);
      // navigate to OTP verification with email
      navigate('/verify-otp', { state: { email: formData.email, isSignup: true } });
    } catch (err) {
      console.error(err);
      setErrors({ form: 'Failed to sign up. Try again.' });
    }
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsLoading(false);
    
  };

  return (
    <AuthLayout 
      title="Create an account" 
      subtitle="Join our community today"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
          <input
            type="text"
            className={`w-full px-4 py-2 rounded-xl border ${errors.fullName ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'} outline-none transition-all duration-200`}
            placeholder="John Doe"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
          {errors.fullName && <p className="mt-1 text-xs text-red-500 font-medium">{errors.fullName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
          <input
            type="email"
            className={`w-full px-4 py-2 rounded-xl border ${errors.email ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'} outline-none transition-all duration-200`}
            placeholder="name@company.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          {errors.email && <p className="mt-1 text-xs text-red-500 font-medium">{errors.email}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              className={`w-full px-4 py-2 rounded-xl border ${errors.password ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'} outline-none transition-all duration-200`}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm</label>
            <input
              type="password"
              className={`w-full px-4 py-2 rounded-xl border ${errors.confirmPassword ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'} outline-none transition-all duration-200`}
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>
          {errors.password && <p className="col-span-2 mt-1 text-xs text-red-500 font-medium">{errors.password}</p>}
          {errors.confirmPassword && !errors.password && <p className="col-span-2 mt-1 text-xs text-red-500 font-medium">{errors.confirmPassword}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">I am a</label>
          <select
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-200 bg-white"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          >
            <option value="Student">Student</option>
            <option value="Teacher">Teacher</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Creating account...
            </>
          ) : (
            'Sign up'
          )}
        </button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
