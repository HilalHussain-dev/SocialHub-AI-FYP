import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  HelpCircle,
  Calendar,
  MessageSquare,
  BarChart2,
  Plus,
  Bookmark,
  Share2,
  Repeat,
  TrendingUp,
  LayoutGrid
} from 'lucide-react';

interface LoginPageProps {
  initialMode?: 'login' | 'register';
  onLoginSuccess: (user: { id: string; email: string; name?: string }) => void;
  onGoToLanding: () => void;
  apiUrl: string;
}

export function LoginPage({ initialMode = 'register', onLoginSuccess, onGoToLanding, apiUrl }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync with initialMode when prop changes
  useEffect(() => {
    setIsRegister(initialMode === 'register');
  }, [initialMode]);

  // Validation checks for password in register mode
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegister && (!hasMinLength || !hasUppercase || !hasNumberOrSymbol)) {
      setError('Please fulfill all password requirements before signing up.');
      return;
    }

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
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-between font-sans selection:bg-[#c2f2b4] selection:text-gray-900">
      
      {/* Main Split Layout Container */}
      <div className="flex-1 max-w-[1340px] w-full mx-auto px-4 sm:px-8 py-8 md:py-12 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: AUTH FORM (MATCHING REFERENCE EXACTLY) */}
        {/* ========================================================= */}
        <div className="w-full max-w-[390px] mx-auto lg:mx-0 flex flex-col text-left py-4">
          
          {/* Buffer Logo (3 stacked polygon layers) */}
          <div 
            onClick={onGoToLanding}
            className="cursor-pointer mb-5 flex justify-center group"
            title="Go to Landing Page"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-900 group-hover:scale-105 transition-transform">
              <path d="M1.5 5.5L12 11.25L22.5 5.5L12 0L1.5 5.5Z" />
              <path d="M1.5 12L12 17.75L22.5 12L19.5 10.35L12 14.5L4.5 10.35L1.5 12Z" />
              <path d="M1.5 18.5L12 24.25L22.5 18.5L19.5 16.85L12 21L4.5 16.85L1.5 18.5Z" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-[25px] sm:text-[27px] font-extrabold text-gray-950 tracking-tight text-center">
            {isRegister ? 'Create a Buffer Account' : 'Log in to Buffer'}
          </h1>

          {/* Subtitle with Switch Mode Link */}
          <p className="text-[13.5px] text-gray-700 mt-2 mb-7 text-center font-normal">
            {isRegister ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setError('');
                    window.location.hash = '#login';
                  }}
                  className="font-semibold text-[#275e37] underline underline-offset-4 decoration-[#275e37]/50 hover:decoration-[#275e37] hover:text-[#1c4829] transition cursor-pointer"
                >
                  Log in instead
                </button>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setError('');
                    window.location.hash = '#register';
                  }}
                  className="font-semibold text-[#275e37] underline underline-offset-4 decoration-[#275e37]/50 hover:decoration-[#275e37] hover:text-[#1c4829] transition cursor-pointer"
                >
                  Create one instead
                </button>
              </>
            )}
          </p>

          {/* Error Message */}
          {error && (
            <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-gray-800">
                  {isRegister ? 'Create Password' : 'Password'}
                </label>
                {!isRegister && (
                  <a href="#" className="text-xs font-medium text-gray-500 hover:text-gray-800 underline">
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
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements (shown on registration, matching image bullets) */}
            {isRegister && (
              <div className="space-y-1.5 pt-1 text-xs">
                <div className={`flex items-center gap-2 transition-colors ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasMinLength ? 'bg-emerald-600' : 'bg-gray-300'}`} />
                  <span>At least 8 characters long</span>
                </div>
                <div className={`flex items-center gap-2 transition-colors ${hasUppercase ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasUppercase ? 'bg-emerald-600' : 'bg-gray-300'}`} />
                  <span>Contains 1 uppercase character</span>
                </div>
                <div className={`flex items-center gap-2 transition-colors ${hasNumberOrSymbol ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasNumberOrSymbol ? 'bg-emerald-600' : 'bg-gray-300'}`} />
                  <span>Contains 1 number or symbol</span>
                </div>
              </div>
            )}

            {/* Submit Button (Sign Up in image) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 bg-[#b2f0a5] hover:bg-[#a1e793] active:bg-[#92dc83] disabled:opacity-50 text-gray-950 font-bold rounded-lg text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isRegister ? 'Creating account...' : 'Signing in...'}</span>
                </>
              ) : (
                <span>{isRegister ? 'Sign Up' : 'Log In'}</span>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Info */}
          {!isRegister && (
            <p className="text-[11px] text-gray-400 mt-4 text-center">
              Demo account: <span className="font-semibold text-gray-600">hilalhussain1049@gmail.com</span> / <span className="font-semibold text-gray-600">Hilal@123</span>
            </p>
          )}

          {/* Legal / Policy Links */}
          <div className="pt-8 text-center text-xs text-gray-600 flex flex-wrap items-center justify-center gap-2.5">
            <a href="#" className="hover:text-gray-950 underline underline-offset-2 flex items-center gap-0.5">
              Terms of Service <ArrowUpRight className="w-3 h-3" />
            </a>
            <span className="text-gray-400">·</span>
            <a href="#" className="hover:text-gray-950 underline underline-offset-2 flex items-center gap-0.5">
              Privacy Policy <ArrowUpRight className="w-3 h-3" />
            </a>
            <span className="text-gray-400">·</span>
            <a href="#" className="hover:text-gray-950 underline underline-offset-2 flex items-center gap-0.5">
              Security <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>

        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: "INTRODUCING INSIGHTS" REFERENCE MOCKUP */}
        {/* ========================================================= */}
        <div className="w-full lg:max-w-[700px] xl:max-w-[760px] flex-1">
          <div className="bg-[#f3efe6] border border-[#e8e2d4] rounded-[28px] sm:rounded-[34px] p-6 sm:p-9 pb-0 overflow-hidden shadow-sm">
            
            {/* Top Badge: NEW */}
            <div className="inline-block bg-[#284931] text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider mb-3">
              NEW
            </div>

            {/* Headline */}
            <h2 className="text-3xl sm:text-[42px] font-extrabold text-[#191e1a] tracking-tight leading-[1.08] mb-2.5">
              Introducing Insights
            </h2>

            {/* Subtitle */}
            <p className="text-gray-600 text-[14.5px] sm:text-base font-normal mb-7">
              Analytics that show you your next move
            </p>

            {/* Buffer Insights UI Mockup Screen (Replicating Reference Image) */}
            <div className="bg-white rounded-t-2xl border-t border-l border-r border-gray-200 shadow-xl overflow-hidden flex flex-row">
              
              {/* Mini Left Sidebar */}
              <div className="w-11 bg-white border-r border-gray-100 py-3 flex flex-col items-center justify-between shrink-0 select-none">
                <div className="space-y-3.5 flex flex-col items-center">
                  {/* Mini Buffer logo */}
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-800">
                    <path d="M1.5 5.5L12 11.25L22.5 5.5L12 0L1.5 5.5Z" />
                    <path d="M1.5 12L12 17.75L22.5 12L19.5 10.35L12 14.5L4.5 10.35L1.5 12Z" />
                    <path d="M1.5 18.5L12 24.25L22.5 18.5L19.5 16.85L12 21L4.5 16.85L1.5 18.5Z" />
                  </svg>
                  
                  {/* Green + button */}
                  <div className="w-6 h-6 rounded-md bg-[#a6e59a] flex items-center justify-center text-gray-900 font-bold text-xs">
                    +
                  </div>

                  <HelpCircle className="w-4 h-4 text-gray-400" />
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  
                  {/* Highlighted Insights BarChart Icon */}
                  <div className="p-1 rounded bg-gray-100 text-gray-900">
                    <BarChart2 className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Main Mockup Content Canvas */}
              <div className="flex-1 p-4 sm:p-5 bg-white min-w-0">
                
                {/* Header Controls: All Channels dropdown + Date range pills */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                    <LayoutGrid className="w-3.5 h-3.5 text-gray-600" />
                    <span>All Channels</span>
                    <Bookmark className="w-3 h-3 text-gray-400 ml-0.5" />
                  </div>

                  <div className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-gray-600">
                    <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-md font-semibold text-gray-900 shadow-sm">
                      7 days
                    </span>
                    <span className="px-2 py-1 hover:text-gray-900 cursor-pointer">30 days</span>
                    <span className="px-2 py-1 hover:text-gray-900 cursor-pointer hidden sm:inline">Month to date</span>
                    <span className="px-2 py-1 hover:text-gray-900 cursor-pointer hidden md:inline">Last month</span>
                    <span className="px-2 py-1 hover:text-gray-900 cursor-pointer hidden sm:inline">Custom</span>
                    <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-[10px] text-gray-700 font-semibold ml-1">
                      Compare: Prev. Period
                    </span>
                  </div>
                </div>

                {/* Section: WEEKLY TAKEAWAYS ^ (Light Blue Box) */}
                <div className="bg-[#ebf4fe] border border-blue-100 rounded-xl p-3.5 mb-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-extrabold text-[#1d4ed8] uppercase tracking-wider flex items-center gap-1">
                      <span>Weekly Takeaways</span>
                      <span className="text-xs">⌃</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    
                    {/* Card 1 */}
                    <div className="bg-white rounded-lg p-2.5 border border-blue-50 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-gray-900 mb-1">
                          <TrendingUp className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">Publish Your Overdue Draft</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-snug line-clamp-2">
                          You have two drafts waiting, one overdue. Share your thoughts on Buffer's open API to engage your audience.
                        </p>
                      </div>
                      <button type="button" className="mt-2.5 w-fit px-2 py-0.5 border border-gray-200 rounded text-[10px] font-semibold text-gray-700 bg-white hover:bg-gray-50">
                        Explore Templates
                      </button>
                    </div>

                    {/* Card 2 */}
                    <div className="bg-white rounded-lg p-2.5 border border-blue-50 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-gray-900 mb-1">
                          <Repeat className="w-3 h-3 text-pink-600 shrink-0" />
                          <span className="truncate">Repost Your Popular Post</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-snug line-clamp-2">
                          Repost your engaging post about your ambitious project. It resonated well, with a reach of 1781.
                        </p>
                      </div>
                      <button type="button" className="mt-2.5 w-fit px-2 py-0.5 border border-gray-200 rounded text-[10px] font-semibold text-gray-700 bg-white hover:bg-gray-50">
                        Create Post
                      </button>
                    </div>

                    {/* Card 3 */}
                    <div className="bg-white rounded-lg p-2.5 border border-blue-50 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-gray-900 mb-1">
                          <ArrowUpRight className="w-3 h-3 text-purple-600 shrink-0" />
                          <span className="truncate">Boost Posting Goals</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-snug line-clamp-2">
                          Your posting goal: you've only sent 2 more posts to maintain community momentum this week.
                        </p>
                      </div>
                      <button type="button" className="mt-2.5 w-fit px-2 py-0.5 border border-gray-200 rounded text-[10px] font-semibold text-gray-700 bg-white hover:bg-gray-50">
                        Create Post
                      </button>
                    </div>

                  </div>
                </div>

                {/* Section: Summary Metrics Grid */}
                <div className="border border-gray-100 rounded-xl p-3 bg-white">
                  <div className="mb-2">
                    <p className="text-xs font-bold text-gray-900">Summary</p>
                    <p className="text-[9.5px] text-gray-400">May 19 – Jun 18, 2026 Compared to Apr 19 – May 17, 2026</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
                    
                    {/* Posts */}
                    <div className="p-2 bg-gray-50/70 rounded-lg border border-gray-100">
                      <p className="text-[9.5px] text-gray-400 font-semibold uppercase">Posts</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-extrabold text-gray-900">67</span>
                        <span className="text-[9px] font-bold text-emerald-600">↗ 1.7%</span>
                      </div>
                    </div>

                    {/* Followers */}
                    <div className="p-2 bg-gray-50/70 rounded-lg border border-gray-100">
                      <p className="text-[9.5px] text-gray-400 font-semibold uppercase">Followers</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-extrabold text-gray-900">2.2k</span>
                        <span className="text-[9px] font-bold text-emerald-600">↗ 2.6%</span>
                      </div>
                    </div>

                    {/* Likes */}
                    <div className="p-2 bg-gray-50/70 rounded-lg border border-gray-100">
                      <p className="text-[9.5px] text-gray-400 font-semibold uppercase">Likes</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-extrabold text-gray-900">7,295</span>
                        <span className="text-[9px] font-bold text-emerald-600">↗ 8.3%</span>
                      </div>
                    </div>

                    {/* Comments */}
                    <div className="p-2 bg-gray-50/70 rounded-lg border border-gray-100">
                      <p className="text-[9.5px] text-gray-400 font-semibold uppercase">Comments</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-extrabold text-gray-900">152</span>
                        <span className="text-[9px] font-bold text-gray-400">stable</span>
                      </div>
                    </div>

                    {/* Impressions */}
                    <div className="p-2 bg-gray-50/70 rounded-lg border border-gray-100">
                      <p className="text-[9.5px] text-gray-400 font-semibold uppercase">Impressions</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-extrabold text-gray-900">520k</span>
                        <span className="text-[9px] font-bold text-emerald-600">↗ 12%</span>
                      </div>
                    </div>

                    {/* Shares */}
                    <div className="p-2 bg-gray-50/70 rounded-lg border border-gray-100">
                      <p className="text-[9.5px] text-gray-400 font-semibold uppercase">Shares</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-extrabold text-gray-900">12</span>
                        <span className="text-[9px] font-bold text-emerald-600">↗ 1.2%</span>
                      </div>
                    </div>

                    {/* Saves */}
                    <div className="p-2 bg-gray-50/70 rounded-lg border border-gray-100">
                      <p className="text-[9.5px] text-gray-400 font-semibold uppercase">Saves</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-extrabold text-gray-900">21</span>
                        <span className="text-[9px] font-bold text-emerald-600">↗ 12%</span>
                      </div>
                    </div>

                    {/* Reach */}
                    <div className="p-2 bg-gray-50/70 rounded-lg border border-gray-100">
                      <p className="text-[9.5px] text-gray-400 font-semibold uppercase">Reach</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-extrabold text-gray-900">120k</span>
                        <span className="text-[9px] font-bold text-emerald-600">↗ 5.4%</span>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
