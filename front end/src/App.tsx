import React, { useState, useEffect } from 'react';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { TrustedBy } from './components/TrustedBy';
import { Channels } from './components/Channels';
import { CoreFeatures } from './components/CoreFeatures';
import { MoreFeatures } from './components/MoreFeatures';
import { AISection } from './components/AISection';
import { Support } from './components/Support';
import { Metrics } from './components/Metrics';
import { CTA } from './components/CTA';
import { Footer } from './components/Footer';
import { PricingPage } from './components/pricing/PricingPage';
import { LoginPage } from './components/auth/LoginPage';
import { BufferDashboard } from './components/admin/BufferDashboard';
import { AccountPickerModal, type FacebookPageOption, type InstagramAccountOption } from './components/admin/AccountPickerModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface User {
  id: string;
  email: string;
  name?: string;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  // Authenticated user state
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Current view: 'landing' | 'login' | 'dashboard'
  // Default entry view is ALWAYS 'landing' unless specifically navigating to auth or dashboard
  const [view, setView] = useState<'landing' | 'login' | 'dashboard'>(() => {
    if (typeof window !== 'undefined') {
      try {
        // Clear any old view state persisted in localStorage so it doesn't force dashboard on fresh load
        localStorage.removeItem('socialhub_view');
      } catch {}

      const h = window.location.hash;
      const p = window.location.pathname;

      // Auth routes
      if (h === '#login' || h === '#register' || h === '#signup' || p === '/login' || p === '/register' || p === '/signup') {
        return 'login';
      }

      // OAuth callbacks always require dashboard view
      if (p === '/facebook/callback' || p === '/instagram/callback' || p === '/pinterest/callback' || p === '/linkedin/callback' || p === '/tiktok/callback') {
        return 'dashboard';
      }

      // Explicit dashboard route
      if (h === '#admin' || h === '#dashboard' || p === '/dashboard') {
        return 'dashboard';
      }
    }
    return 'landing';
  });

  // Auth initial mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash;
      const p = window.location.pathname;
      if (h === '#login' || p === '/login') {
        return 'login';
      }
      if (h === '#register' || h === '#signup' || p === '/register' || p === '/signup') {
        return 'register';
      }
    }
    return 'register';
  });

  // Account picker state (shown after OAuth callback)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPlatform, setPickerPlatform] = useState<'facebook' | 'instagram'>('facebook');
  const [pickerPendingKey, setPickerPendingKey] = useState('');
  const [pickerFbPages, setPickerFbPages] = useState<FacebookPageOption[]>([]);
  const [pickerIgAccounts, setPickerIgAccounts] = useState<InstagramAccountOption[]>([]);

  // Trigger to reload channels inside dashboard without page reload
  const [channelRefreshKey, setChannelRefreshKey] = useState(0);

  // Listen to navigation events
  useEffect(() => {
    const handleNavigation = () => {
      const h = window.location.hash;
      const p = window.location.pathname;
      setCurrentPath(p);
      setCurrentHash(h);

      if (
        h === '#admin' ||
        h === '#dashboard' ||
        p === '/dashboard' ||
        p === '/facebook/callback' ||
        p === '/instagram/callback' ||
        p === '/pinterest/callback' ||
        p === '/linkedin/callback' ||
        p === '/tiktok/callback'
      ) {
        setView('dashboard');
      } else if (
        h === '#register' ||
        h === '#signup' ||
        p === '/register' ||
        p === '/signup'
      ) {
        setAuthMode('register');
        setView('login');
      } else if (h === '#login' || p === '/login') {
        setAuthMode('login');
        setView('login');
      } else {
        // Root '/' or empty hash or '#pricing' - default landing page
        setView('landing');
      }
    };

    // Run on mount
    handleNavigation();

    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);

    return () => {
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('hashchange', handleNavigation);
    };
  }, []);

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            const h = window.location.hash;
            const p = window.location.pathname;
            // Only switch to dashboard if explicitly requested via hash or path
            if (h === '#dashboard' || h === '#admin' || p === '/dashboard' || p.includes('/callback')) {
              setView('dashboard');
              if (window.location.hash !== '#dashboard') {
                window.location.hash = '#dashboard';
              }
            }
          } else {
            setUser(null);
            // If user is not authenticated and hash is #dashboard or #admin, redirect to landing
            const h = window.location.hash;
            const p = window.location.pathname;
            if (h === '#dashboard' || h === '#admin' || p === '/dashboard') {
              setView('landing');
              window.location.hash = '';
              window.history.replaceState({}, '', '/');
            }
          }
        } else {
          setUser(null);
          // If auth check fails (401/403) and user is on #dashboard, redirect to landing
          const h = window.location.hash;
          const p = window.location.pathname;
          if (h === '#dashboard' || h === '#admin' || p === '/dashboard') {
            setView('landing');
            window.location.hash = '';
            window.history.replaceState({}, '', '/');
          }
        }
      } catch (err) {
        console.warn('Session check error:', err);
        setUser(null);
        const h = window.location.hash;
        const p = window.location.pathname;
        if (h === '#dashboard' || h === '#admin' || p === '/dashboard') {
          setView('landing');
          window.location.hash = '';
          window.history.replaceState({}, '', '/');
        }
      } finally {
        setAuthChecking(false);
      }
    };

    checkSession();
  }, []);

  // Handle OAuth Callbacks (/facebook/callback, /instagram/callback, /pinterest/callback, /linkedin/callback, or /tiktok/callback)
  useEffect(() => {
    const isCallback = currentPath === '/facebook/callback' || currentPath === '/instagram/callback' || currentPath === '/pinterest/callback' || currentPath === '/linkedin/callback' || currentPath === '/tiktok/callback' || window.location.pathname === '/facebook/callback' || window.location.pathname === '/instagram/callback' || window.location.pathname === '/pinterest/callback' || window.location.pathname === '/linkedin/callback' || window.location.pathname === '/tiktok/callback';

    if (isCallback) {
      const params = new URLSearchParams(window.location.search);
      const pendingKey = params.get('pending');
      const platform = params.get('platform') as 'facebook' | 'instagram' | 'pinterest' | 'linkedin' | 'tiktok' | null;
      const error = params.get('error');

      // Always stay in dashboard view
      setView('dashboard');
      window.location.hash = '#dashboard';

      if (error) {
        // Clean up URL and let dashboard handle error display
        window.history.replaceState({}, '', '/#dashboard');
        return;
      }

      if (platform === 'pinterest' || platform === 'linkedin' || platform === 'tiktok') {
        // Smoothly reload channels in dashboard
        setChannelRefreshKey((prev) => prev + 1);
      }

      if (pendingKey && platform) {
        setPickerPendingKey(pendingKey);
        if (platform === 'facebook' || platform === 'instagram') {
          setPickerPlatform(platform);
        }

        if (platform === 'facebook') {
          try {
            const pages = JSON.parse(params.get('pages') || '[]');
            setPickerFbPages(pages);
          } catch { setPickerFbPages([]); }
        } else if (platform === 'instagram') {
          try {
            const accounts = JSON.parse(params.get('accounts') || '[]');
            setPickerIgAccounts(accounts);
          } catch { setPickerIgAccounts([]); }
        }

        // Show picker after a short delay so dashboard renders first
        setTimeout(() => setPickerOpen(true), 300);
      }

      // Clean URL
      window.history.replaceState({}, '', '/#dashboard');
      window.location.hash = '#dashboard';
    }
  }, [currentPath]);


  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setView('dashboard');
    window.location.hash = '#dashboard';
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('socialhub_view');
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    setUser(null);
    setView('landing');
    window.location.hash = '';
    window.history.replaceState({}, '', '/');
  };

  // =====================================================
  // VIEW: BUFFER ADMIN DASHBOARD
  // =====================================================
  if (view === 'dashboard') {
    if (authChecking) {
      return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-gray-900 animate-pulse">
              <path d="M1.5 5.5L12 11.25L22.5 5.5L12 0L1.5 5.5Z" />
              <path d="M1.5 12L12 17.75L22.5 12L19.5 10.35L12 14.5L4.5 10.35L1.5 12Z" />
              <path d="M1.5 18.5L12 24.25L22.5 18.5L19.5 16.85L12 21L4.5 16.85L1.5 18.5Z" />
            </svg>
            <p className="text-sm text-gray-500 font-medium">Loading workspace...</p>
          </div>
        </div>
      );
    }

    if (!user) {
      // If user is not logged in, show the Login Page
      return (
        <LoginPage
          initialMode={authMode}
          onLoginSuccess={handleLoginSuccess}
          onGoToLanding={() => {
            setView('landing');
            window.location.hash = '';
            window.history.replaceState({}, '', '/');
          }}
          apiUrl={API_URL}
        />
      );
    }

    return (
      <>
        <BufferDashboard
          user={user}
          onLogout={handleLogout}
          onGoToLanding={() => {
            setView('landing');
            window.location.hash = '';
            window.history.replaceState({}, '', '/');
          }}
          apiUrl={API_URL}
          refreshTrigger={channelRefreshKey}
        />
        <AccountPickerModal
          isOpen={pickerOpen}
          onClose={() => {
            setPickerOpen(false);
            setView('dashboard');
            window.location.hash = '#dashboard';
          }}
          platform={pickerPlatform}
          pendingKey={pickerPendingKey}
          facebookPages={pickerFbPages}
          instagramAccounts={pickerIgAccounts}
          apiUrl={API_URL}
          onConnected={() => {
            setPickerOpen(false);
            setView('dashboard');
            window.location.hash = '#dashboard';
            // Smoothly reload channels in dashboard without page refresh!
            setChannelRefreshKey((prev) => prev + 1);
          }}
        />
      </>
    );
  }

  // =====================================================
  // VIEW: BUFFER AUTH PAGE (LOGIN / CREATE ACCOUNT)
  // =====================================================
  if (view === 'login') {
    return (
      <LoginPage
        initialMode={authMode}
        onLoginSuccess={handleLoginSuccess}
        onGoToLanding={() => {
          setView('landing');
          window.location.hash = '';
          window.history.replaceState({}, '', '/');
        }}
        apiUrl={API_URL}
      />
    );
  }

  // =====================================================
  // VIEW: DEFAULT PUBLIC LANDING PAGE
  // =====================================================
  return (
    <div
      className="min-h-screen bg-white text-gray-900"
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <Nav
        user={user}
        onOpenAuth={(mode) => {
          setAuthMode(mode);
          setView('login');
          window.location.hash = mode === 'register' ? '#register' : '#login';
        }}
        onOpenAdmin={() => {
          setView('dashboard');
          window.location.hash = '#dashboard';
        }}
        onLogout={handleLogout}
      />

      {currentHash === '#pricing' ? (
        <div className="pt-20">
          <PricingPage />
        </div>
      ) : (
        <main className="pt-16">
          <Hero />
          <TrustedBy />
          <CoreFeatures />
          <MoreFeatures />
          <AISection />
          <Support />
          <Metrics />
          <CTA />
        </main>
      )}

      <Footer />
    </div>
  );
}