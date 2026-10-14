import React, { useState } from 'react';
import { Eye, EyeOff, ArrowUpRight, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: { id: string; email: string; name?: string }) => void;
  onGoToLanding: () => void;
  apiUrl: string;
}

export function LoginPage({ onLoginSuccess, onGoToLanding, apiUrl }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? `${apiUrl}/api/auth/register` : `${apiUrl}/api/auth/login`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-between font-sans">
      
      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:py-12 flex flex-col lg:flex-row items-center justify-between gap-12">
        
        {/* Left Column: Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0 flex flex-col items-center text-center">
          
          {/* Buffer Icon (3 stacked layers) */}
          <div 
            onClick={onGoToLanding}
            className="cursor-pointer mb-6"
            title="Go to Landing Page"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-gray-900">
              <path d="M1.5 5.5L12 11.25L22.5 5.5L12 0L1.5 5.5Z" />
              <path d="M1.5 12L12 17.75L22.5 12L19.5 10.35L12 14.5L4.5 10.35L1.5 12Z" />
              <path d="M1.5 18.5L12 24.25L22.5 18.5L19.5 16.85L12 21L4.5 16.85L1.5 18.5Z" />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {isRegister ? 'Sign up for Buffer' : 'Log in to Buffer'}
          </h1>

          {/* Subtitle / Mode toggle */}
          <p className="text-sm text-gray-600 mt-2 mb-8">
            {isRegister ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setError(''); }}
                  className="font-medium text-gray-900 underline hover:text-gray-700 cursor-pointer"
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                New to Buffer?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(''); }}
                  className="font-medium text-gray-900 underline hover:text-gray-700 cursor-pointer"
                >
                  Create an account
                </button>
              </>
            )}
          </p>

          {/* Error Message */}
          {error && (
            <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold text-left">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-4 text-left">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  Password
                </label>
                {!isRegister && (
                  <a href="#" className="text-xs font-medium text-gray-500 hover:text-gray-700 underline">
                    Forgot Password?
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button ("Continue") */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-[#a6e59a] hover:bg-[#95d489] disabled:opacity-50 text-gray-950 font-bold rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Continue</span>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Info */}
          <p className="text-[11px] text-gray-400 mt-6">
            Default credentials: <span className="font-semibold text-gray-600">hilalhussain1049@gmail.com</span> / <span className="font-semibold text-gray-600">Hilal@123</span>
          </p>

          <button
            onClick={onGoToLanding}
            className="mt-4 text-xs font-semibold text-gray-500 hover:text-gray-800 underline cursor-pointer"
          >
            ← Back to Landing Page
          </button>
        </div>

        {/* Right Column: Reference Card ("Introducing Insights") */}
        <div className="w-full lg:max-w-xl">
          <div className="bg-[#d2f4cd] rounded-[36px] p-8 md:p-12 relative overflow-hidden flex flex-col justify-between min-h-[500px]">
            
            {/* Top Badge & Header */}
            <div>
              <div className="inline-block bg-[#244f1c] text-white text-[11px] font-extrabold px-3 py-1 rounded-md uppercase tracking-wider mb-3">
                NEW
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Introducing Insights
              </h2>
            </div>

            {/* Graphic Illustration */}
            <div className="relative my-8 h-56 flex items-end justify-center">
              
              {/* Dotted green curve */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 200" fill="none">
                <path 
                  d="M 10 130 C 100 130, 200 120, 320 70" 
                  stroke="#387a2a" 
                  strokeWidth="2.5" 
                  strokeDasharray="4 4" 
                />
                <polygon points="320,60 330,75 315,75" fill="#387a2a" />
              </svg>

              {/* Floating Impression Pill (Top Left) */}
              <div className="absolute top-2 left-4 bg-white/95 backdrop-blur-sm rounded-xl py-2 px-3.5 shadow-md border border-white text-left z-10 animate-fade-in">
                <p className="text-[10px] text-gray-500 font-semibold uppercase">Impressions</p>
                <p className="text-sm font-extrabold text-gray-900">33,500 <span className="text-emerald-600">📈</span></p>
              </div>

              {/* Floating Followers Pill (Top Right) */}
              <div className="absolute top-12 right-6 bg-white/95 backdrop-blur-sm rounded-xl py-2 px-3.5 shadow-md border border-white text-left z-10 animate-fade-in">
                <p className="text-[10px] text-gray-500 font-semibold uppercase">Followers</p>
                <p className="text-sm font-extrabold text-gray-900">120k <span className="text-emerald-600">📈</span></p>
              </div>

              {/* Bar Chart Bars */}
              <div className="flex items-end gap-3.5 h-44 pb-4">
                {/* Bar 1 */}
                <div className="w-7 rounded-t-lg bg-[#539743] h-28 flex flex-col justify-end">
                  <div className="w-full bg-[#346b27] h-14 rounded-t-lg"></div>
                </div>
                {/* Bar 2 */}
                <div className="w-7 rounded-t-lg bg-[#6bb759] h-36 flex flex-col justify-end">
                  <div className="w-full bg-[#417f30] h-24 rounded-t-lg"></div>
                </div>
                {/* Bar 3 */}
                <div className="w-7 rounded-t-lg bg-[#86d473] h-20 flex flex-col justify-end">
                  <div className="w-full bg-[#539743] h-10 rounded-t-lg"></div>
                </div>
                {/* Bar 4 */}
                <div className="w-7 rounded-t-lg bg-[#539743] h-34 flex flex-col justify-end">
                  <div className="w-full bg-[#346b27] h-20 rounded-t-lg"></div>
                </div>
                {/* Bar 5 */}
                <div className="w-7 rounded-t-lg bg-[#6bb759] h-28 flex flex-col justify-end">
                  <div className="w-full bg-[#417f30] h-16 rounded-t-lg"></div>
                </div>
                {/* Bar 6 */}
                <div className="w-7 rounded-t-lg bg-[#539743] h-32 flex flex-col justify-end">
                  <div className="w-full bg-[#346b27] h-18 rounded-t-lg"></div>
                </div>
              </div>

              {/* Floating White Card in Foreground */}
              <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-[85%] bg-white rounded-2xl p-3.5 shadow-lg border border-gray-100 flex items-center gap-3 z-20 text-left">
                <div className="w-9 h-9 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center text-sm shrink-0">
                  🔄
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Your Weekly Takeaway</p>
                  <p className="text-xs font-bold text-gray-900 leading-snug">
                    Repost Your Popular Post To Increase Engagement
                  </p>
                </div>
              </div>

            </div>

            {/* Bottom Subtitle */}
            <p className="text-sm font-semibold text-gray-800 text-center pt-4">
              Analytics that show you your next move
            </p>

          </div>
        </div>

      </div>

      {/* Footer Links */}
      <footer className="py-6 px-6 text-center text-xs text-gray-500 flex flex-wrap justify-center gap-4">
        <a href="#" className="hover:text-gray-900 flex items-center gap-1">Terms of Service <ArrowUpRight className="w-3 h-3" /></a>
        <span>·</span>
        <a href="#" className="hover:text-gray-900 flex items-center gap-1">Privacy Policy <ArrowUpRight className="w-3 h-3" /></a>
        <span>·</span>
        <a href="#" className="hover:text-gray-900 flex items-center gap-1">Security <ArrowUpRight className="w-3 h-3" /></a>
      </footer>

    </div>
  );
}
