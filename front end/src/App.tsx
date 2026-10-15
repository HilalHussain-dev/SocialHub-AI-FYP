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
  const [view, setView] = useState<'landing' | 'login' | 'dashboard'>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash;
      const p = window.location.pathname;
      if (h === '#admin' || h === '#dashboard' || p === '/dashboard' || p === '/facebook/callback' || p === '/instagram/callback') {
        return 'dashboard';
      }
      if (h === '#login' || h === '#register' || h === '#signup' || p === '/login' || p === '/register' || p === '/signup') {
        return 'login';
      }
      try {
        const saved = localStorage.getItem('socialhub_view');
        if (saved === 'dashboard') return 'dashboard';
      } catch {}
    }
    return 'landing';
  });

  // Helper to persist view state
  const updateView = (newView: 'landing' | 'login' | 'dashboard') => {
    setView(newView);
    try {
      localStorage.setItem('socialhub_view', newView);
    } catch {}
  };

  // Auth initial mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash;
      const p = window.location.pathname;
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

      if (h === '#admin' || h === '#dashboard' || p === '/dashboard' || p === '/facebook/callback' || p === '/instagram/callback') {
        updateView('dashboard');
      } else if (
        h === '#register' ||
        h === '#signup' ||
        p === '/register' ||
        p === '/signup'
      ) {
        setAuthMode('register');
        updateView('login');
      } else if (h === '#login' || p === '/login') {
        setAuthMode('login');
        updateView('login');
      } else if (h === '' && p === '/') {
        try {
          const saved = localStorage.getItem('socialhub_view');
          if (saved === 'dashboard') {
            updateView('dashboard');
            window.location.hash = '#dashboard';
            return;
          }
        } catch {}
        updateView('landing');
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
            let saved = null;
            try { saved = localStorage.getItem('socialhub_view'); } catch {}
            if (h === '#dashboard' || h === '#admin' || p === '/dashboard' || saved === 'dashboard' || p.includes('/callback')) {
              updateView('dashboard');
              if (window.location.hash !== '#dashboard') {
                window.location.hash = '#dashboard';
              }
            }
          }
        }
      } catch (err) {
        console.warn('Session check error:', err);
      } finally {
        setAuthChecking(false);
      }
    };

    checkSession();
  }, []);

  // Handle OAuth Callbacks (/facebook/callback or /instagram/callback)
  useEffect(() => {
    const isCallback = currentPath === '/facebook/callback' || currentPath === '/instagram/callback' || window.location.pathname === '/facebook/callback' || window.location.pathname === '/instagram/callback';

    if (isCallback) {
      const params = new URLSearchParams(window.location.search);
      const pendingKey = params.get('pending');
      const platform = params.get('platform') as 'facebook' | 'instagram' | null;
      const error = params.get('error');

      // Always stay in dashboard view
      updateView('dashboard');
      window.location.hash = '#dashboard';

      if (error) {
        // Clean up URL and let dashboard handle error display
        window.history.replaceState({}, '', '/#dashboard');
        return;
      }

      if (pendingKey && platform) {
        setPickerPendingKey(pendingKey);
        setPickerPlatform(platform);

        if (platform === 'facebook') {
          try {
            const pages = JSON.parse(params.get('pages') || '[]');
            setPickerFbPages(pages);
          } catch { setPickerFbPages([]); }
        } else {
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
    updateView('dashboard');
    window.location.hash = '#dashboard';
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('socialhub_view');
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    setUser(null);
    updateView('landing');
    window.location.hash = '';
    window.location.pathname = '/';
  };

  // =====================================================
  // VIEW: BUFFER ADMIN DASHBOARD (MATCHING IMAGE 1)
  // =====================================================
  if (view === 'dashboard') {
    if (!user && !authChecking) {
      // If user is not logged in, show the Login Page
      return (
        <LoginPage
          initialMode={authMode}
          onLoginSuccess={handleLoginSuccess}
          onGoToLanding={() => {
            updateView('landing');
            window.location.hash = '';
          }}
          apiUrl={API_URL}
        />
      );
    }

    return (
      <>
        <BufferDashboard
          user={user || { id: 'admin', email: 'hilalhussain1049@gmail.com', name: 'ahmadkhan61358' }}
          onLogout={handleLogout}
          onGoToLanding={() => {
            updateView('landing');
            window.location.hash = '';
          }}
          apiUrl={API_URL}
          refreshTrigger={channelRefreshKey}
        />
        <AccountPickerModal
          isOpen={pickerOpen}
          onClose={() => {
            setPickerOpen(false);
            updateView('dashboard');
            window.location.hash = '#dashboard';
          }}
          platform={pickerPlatform}
          pendingKey={pickerPendingKey}
          facebookPages={pickerFbPages}
          instagramAccounts={pickerIgAccounts}
          apiUrl={API_URL}
          onConnected={() => {
            setPickerOpen(false);
            updateView('dashboard');
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
          updateView('landing');
          window.location.hash = '';
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
          updateView('login');
          window.location.hash = mode === 'register' ? '#register' : '#login';
        }}
        onOpenAdmin={() => {
          updateView('dashboard');
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
          <Channels onSelectChannel={() => {
            if (!user) {
              setView('login');
              window.location.hash = '#login';
            } else {
              setView('dashboard');
              window.location.hash = '#dashboard';
            }
          }} />
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