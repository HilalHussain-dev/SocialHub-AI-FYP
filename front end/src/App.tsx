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
  const [view, setView] = useState<'landing' | 'login' | 'dashboard'>('landing');

  // Account picker state (shown after OAuth callback)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPlatform, setPickerPlatform] = useState<'facebook' | 'instagram'>('facebook');
  const [pickerPendingKey, setPickerPendingKey] = useState('');
  const [pickerFbPages, setPickerFbPages] = useState<FacebookPageOption[]>([]);
  const [pickerIgAccounts, setPickerIgAccounts] = useState<InstagramAccountOption[]>([]);

  // Listen to navigation events
  useEffect(() => {
    const handleNavigation = () => {
      setCurrentPath(window.location.pathname);
      setCurrentHash(window.location.hash);

      if (window.location.hash === '#admin' || window.location.hash === '#dashboard' || window.location.pathname === '/dashboard') {
        setView('dashboard');
      } else if (window.location.hash === '#login' || window.location.pathname === '/login') {
        setView('login');
      } else if (window.location.hash === '' && window.location.pathname === '/') {
        setView('landing');
      }
    };

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
    if (currentPath === '/facebook/callback' || currentPath === '/instagram/callback') {
      const params = new URLSearchParams(window.location.search);
      const pendingKey = params.get('pending');
      const platform = params.get('platform') as 'facebook' | 'instagram' | null;
      const error = params.get('error');

      // Always redirect to dashboard view first
      setView('dashboard');

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
    }
  }, [currentPath]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setView('dashboard');
    window.location.hash = '#dashboard';
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    setUser(null);
    setView('landing');
    window.location.hash = '';
    window.location.pathname = '/';
  };

  // =====================================================
  // VIEW: BUFFER ADMIN DASHBOARD (MATCHING IMAGE 1)
  // =====================================================
  if (view === 'dashboard') {
    if (!user && !authChecking) {
      // If user is not logged in, show the Login Page (Image 2)
      return (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onGoToLanding={() => { setView('landing'); window.location.hash = ''; }}
          apiUrl={API_URL}
        />
      );
    }

    return (
      <>
        <BufferDashboard
          user={user || { id: 'admin', email: 'hilalhussain1049@gmail.com', name: 'ahmadkhan61358' }}
          onLogout={handleLogout}
          onGoToLanding={() => { setView('landing'); window.location.hash = ''; }}
          apiUrl={API_URL}
        />
        <AccountPickerModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          platform={pickerPlatform}
          pendingKey={pickerPendingKey}
          facebookPages={pickerFbPages}
          instagramAccounts={pickerIgAccounts}
          apiUrl={API_URL}
          onConnected={() => {
            setPickerOpen(false);
            // Reload the page so dashboard fetches fresh channels
            window.location.reload();
          }}
        />
      </>
    );
  }

  // =====================================================
  // VIEW: BUFFER LOGIN PAGE (MATCHING IMAGE 2)
  // =====================================================
  if (view === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onGoToLanding={() => { setView('landing'); window.location.hash = ''; }}
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
          setView('login');
          window.location.hash = '#login';
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