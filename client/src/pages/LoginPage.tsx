/**
 * Login Page
 * Supports login for Students, Teachers, and Admins
 * Features quick-fill demo credentials for easy assessment
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const from = (location.state as any)?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    try {
      await login(email, password);
      toast.success('Logged in successfully!');

      const user = useAuthStore.getState().user;
      if (from) {
        navigate(from, { replace: true });
      } else if (user?.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else if (user?.role === 'TEACHER') {
        navigate('/teacher', { replace: true });
      } else {
        navigate('/simulator', { replace: true });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  const handleQuickFill = (role: 'student' | 'teacher' | 'admin') => {
    if (role === 'student') {
      setEmail('student@sjcem.edu.in');
      setPassword('Student@123');
    } else if (role === 'teacher') {
      setEmail('teacher@sjcem.edu.in');
      setPassword('Teacher@123');
    } else {
      setEmail('admin@sjcem.edu.in');
      setPassword('Admin@123');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-3xl mb-4 shadow-lg shadow-amber-500/10">
            ⚛️
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-heading">Welcome Back</h1>
          <p className="text-sm text-neutral-400 mt-2">
            St. John College of Engineering and Management – Virtual Lab
          </p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />

          {errorMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
                Institutional Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@sjcet.edu.in"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white text-sm transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white text-sm transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold tracking-wide transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Fill Demo Accounts */}
          <div className="mt-6 pt-6 border-t border-neutral-800/80">
            <p className="text-xs text-neutral-400 font-medium mb-2.5 text-center">
              Quick-Fill Test Credentials:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('student')}
                className="py-1.5 px-2 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition border border-neutral-700"
              >
                👨‍🎓 Student
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('teacher')}
                className="py-1.5 px-2 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition border border-neutral-700"
              >
                👩‍🏫 Teacher
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="py-1.5 px-2 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition border border-neutral-700"
              >
                ⚡ Admin
              </button>
            </div>
          </div>
        </div>

        {/* Register Footer */}
        <p className="text-center text-sm text-neutral-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-4">
            Register now
          </Link>
        </p>
      </div>
    </div>
  );
}
