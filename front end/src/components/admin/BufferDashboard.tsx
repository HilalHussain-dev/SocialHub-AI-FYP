import React, { useState, useEffect } from 'react';
import logo from '../../assets/logo.png';
import { 
  Home, 
  Lightbulb, 
  Calendar, 
  MessageSquare, 
  BarChart2, 
  Plus, 
  CheckCircle2, 
  HelpCircle, 
  X, 
  LogOut, 
  Globe, 
  Image as ImageIcon, 
  Loader2, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  Layers,
  Sprout,
  Send,
  Info
} from 'lucide-react';
import { FaFacebook, FaInstagram, FaLinkedinIn, FaThreads } from 'react-icons/fa6';
import { ConnectNewChannelModal } from './ConnectNewChannelModal';

interface BufferDashboardProps {
  user: { id: string; email: string; name?: string };
  onLogout: () => void;
  onGoToLanding: () => void;
  apiUrl: string;
  refreshTrigger?: number;
}

interface FacebookPage {
  page_id?: string;
  id?: string;
  page_name?: string;
  name?: string;
  category?: string;
}

interface InstagramAccount {
  id?: string;
  instagram_business_id?: string;
  username: string;
  name?: string;
}

interface PostRecord {
  id: string;
  channel: string;
  page_name: string;
  post_id: string;
  message?: string;
  media_url?: string;
  created_at: string;
  status: string;
}

export function BufferDashboard({ user, onLogout, onGoToLanding, apiUrl, refreshTrigger }: BufferDashboardProps) {
  // Navigation tab state
  const [activeNav, setActiveNav] = useState<'home' | 'create' | 'publish' | 'community' | 'insights'>('home');

  // Channel state
  const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
  const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Post history
  const [postsHistory, setPostsHistory] = useState<PostRecord[]>([]);

  // Modals
  const [composerOpen, setComposerOpen] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [channelWidgetDismissed, setChannelWidgetDismissed] = useState(false);

  // Post Composer State
  const [postToFb, setPostToFb] = useState(true);
  const [postToIg, setPostToIg] = useState(false);
  const [selectedFbPageId, setSelectedFbPageId] = useState<string>('');
  const [selectedIgAccountId, setSelectedIgAccountId] = useState<string>('');
  const [postText, setPostText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Load channels & posts
  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const [fbRes, igRes] = await Promise.all([
        fetch(`${apiUrl}/api/facebook/pages?_t=${Date.now()}`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiUrl}/api/instagram/accounts?_t=${Date.now()}`, { credentials: 'include', cache: 'no-store' })
      ]);

      if (fbRes.ok) {
        const fbData = await fbRes.json();
        const pages = fbData.pages || [];
        setFbPages(pages);
        if (pages.length > 0) setSelectedFbPageId(pages[0].page_id || pages[0].id || '');
      }

      if (igRes.ok) {
        const igData = await igRes.json();
        const accounts = igData.accounts || [];
        setIgAccounts(accounts);
        if (accounts.length > 0) setSelectedIgAccountId(accounts[0].instagram_business_id || accounts[0].id || '');
      }
    } catch (e) {
      console.error('Error fetching channels:', e);
    } finally {
      setLoadingChannels(false);
    }
  };

  const loadPosts = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/posts`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPostsHistory(data.posts || []);
      }
    } catch (e) {
      console.error('Error fetching posts:', e);
    }
  };

  useEffect(() => {
    loadChannels();
    loadPosts();
  }, [refreshTrigger]);

  // Calculate connected channels count out of 3
  const connectedCount = (fbPages.length > 0 ? 1 : 0) + (igAccounts.length > 0 ? 1 : 0);

  // File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  // Publish post
  const handlePublish = async () => {
    setPublishError(null);
    setPublishSuccess(null);

    if (!postToFb && !postToIg) {
      setPublishError('Please select at least one channel (Facebook or Instagram).');
      return;
    }

    if (postToIg && !imageFile && !imageUrl.trim()) {
      setPublishError('Instagram requires an image. Please attach an image file or provide a public image URL.');
      return;
    }

    if (postToFb && !postText.trim() && !imageFile && !imageUrl.trim()) {
      setPublishError('Please enter some text or attach an image.');
      return;
    }

    setPublishing(true);
    const messages: string[] = [];

    try {
      // Facebook Publish
      if (postToFb) {
        const targetFbId = selectedFbPageId || fbPages[0]?.page_id || fbPages[0]?.id;
        if (!targetFbId) {
          throw new Error('Please connect a Facebook Page first.');
        }

        let fbRes: Response;
        if (imageFile) {
          const formData = new FormData();
          formData.append('pageId', targetFbId);
          formData.append('message', postText.trim());
          formData.append('image', imageFile);
          fbRes = await fetch(`${apiUrl}/api/auth/facebook/post`, { method: 'POST', body: formData, credentials: 'include' });
        } else {
          fbRes = await fetch(`${apiUrl}/api/auth/facebook/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              pageId: targetFbId,
              message: postText.trim(),
              imageUrl: imageUrl.trim() || undefined,
            }),
          });
        }

        const fbData = await fbRes.json();
        if (!fbRes.ok || !fbData.success) {
          throw new Error(fbData.error || 'Failed to publish to Facebook.');
        }
        messages.push(`Facebook: Published successfully! (ID: ${fbData.postId})`);
      }

      // Instagram Publish
      if (postToIg) {
        const targetIgId = selectedIgAccountId || igAccounts[0]?.instagram_business_id || igAccounts[0]?.id;
        if (!targetIgId && igAccounts.length === 0) {
          throw new Error('Please connect an Instagram Business account first.');
        }

        let igRes: Response;
        if (imageFile) {
          const formData = new FormData();
          if (targetIgId) formData.append('accountId', targetIgId);
          formData.append('caption', postText.trim());
          formData.append('image', imageFile);
          igRes = await fetch(`${apiUrl}/api/auth/instagram/post`, { method: 'POST', body: formData, credentials: 'include' });
        } else {
          igRes = await fetch(`${apiUrl}/api/auth/instagram/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              accountId: targetIgId,
              caption: postText.trim(),
              imageUrl: imageUrl.trim(),
            }),
          });
        }

        const igData = await igRes.json();
        if (!igRes.ok || !igData.success) {
          throw new Error(igData.error || 'Failed to publish to Instagram.');
        }
        messages.push(`Instagram: Published successfully! (ID: ${igData.postId})`);
      }

      setPublishSuccess(messages.join(' • '));
      setPostText('');
      setImageFile(null);
      setImagePreview(null);
      setImageUrl('');
      loadPosts();
      setTimeout(() => {
        setComposerOpen(false);
        setPublishSuccess(null);
      }, 2000);
    } catch (err: any) {
      setPublishError(err.message || 'Publishing failed. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  // Format greeting username
  const rawUsername = user.name || user.email.split('@')[0];
  const displayGreetingUser = rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';

  // Format date: "Mon, Oct 12 2026"
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  return (
    <div className="flex h-screen bg-[#fafafa] text-gray-900 font-sans overflow-hidden">

      {/* ======================= LEFT SIDEBAR ======================= */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between shrink-0 select-none">
        
        <div>
          {/* Logo & Seedling Icon */}
          <div className="h-14 px-5 flex items-center justify-between border-b border-transparent">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveNav('home')}>
              <img src={logo} alt="SocialHub Logo" className="w-7 h-7 object-contain" />
              <span className="font-extrabold text-lg tracking-tight text-gray-900">SocialHub</span>
            </div>

            {/* Seedling Icon */}
            <div className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer" title="SocialHub Sprout">
              <Sprout className="w-5 h-5 text-emerald-600" />
            </div>
          </div>

          {/* "+ New" Button */}
          <div className="p-4 pt-2">
            <button
              onClick={() => { setComposerOpen(true); setPublishSuccess(null); setPublishError(null); }}
              className="w-full py-2.5 px-4 bg-[#a6e59a] hover:bg-[#95d489] text-gray-950 font-bold rounded-2xl text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              New
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-3 space-y-0.5">
            <button
              onClick={() => setActiveNav('home')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeNav === 'home'
                  ? 'bg-[#e5e5e5] text-gray-900 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Home className="w-4 h-4 text-gray-700" />
              Home
            </button>

            <button
              onClick={() => { setComposerOpen(true); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeNav === 'create'
                  ? 'bg-[#e5e5e5] text-gray-900 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Lightbulb className="w-4 h-4 text-gray-700" />
              Create
            </button>

            <button
              onClick={() => setActiveNav('publish')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeNav === 'publish'
                  ? 'bg-[#e5e5e5] text-gray-900 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-700" />
                Publish
              </div>
              <span className="text-xs text-gray-400 font-semibold">{postsHistory.length}</span>
            </button>

            <button
              onClick={() => setActiveNav('community')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeNav === 'community'
                  ? 'bg-[#e5e5e5] text-gray-900 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-gray-700" />
              Community
            </button>

            <button
              onClick={() => setActiveNav('insights')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeNav === 'insights'
                  ? 'bg-[#e5e5e5] text-gray-900 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <BarChart2 className="w-4 h-4 text-gray-700" />
              Insights
            </button>
          </div>

          {/* "Connect channels" Section */}
          <div className="px-5 pt-6 pb-2">
            <p className="text-[11px] font-semibold text-gray-400 tracking-wide mb-2.5">
              Connect channels
            </p>
            <div className="flex items-center gap-2">
              {/* Instagram */}
              <button
                onClick={() => setChannelModalOpen(true)}
                title={igAccounts.length > 0 ? `Connected: @${igAccounts[0].username}` : "Connect Instagram"}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs cursor-pointer transition ${
                  igAccounts.length > 0 ? 'bg-[#E1306C] ring-2 ring-pink-300' : 'bg-gray-300 hover:bg-[#E1306C]'
                }`}
              >
                <FaInstagram />
              </button>

              {/* Threads */}
              <button 
                onClick={() => setChannelModalOpen(true)}
                title="Connect Threads"
                className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center text-xs opacity-80 hover:opacity-100 cursor-pointer"
              >
                <FaThreads />
              </button>

              {/* LinkedIn */}
              <button 
                onClick={() => setChannelModalOpen(true)}
                title="Connect LinkedIn"
                className="w-7 h-7 rounded-lg bg-[#0A66C2] text-white flex items-center justify-center text-xs opacity-80 hover:opacity-100 cursor-pointer"
              >
                <FaLinkedinIn />
              </button>

              {/* Facebook */}
              <button
                onClick={() => setChannelModalOpen(true)}
                title={fbPages.length > 0 ? `Connected: ${fbPages[0].page_name || fbPages[0].name}` : "Connect Facebook"}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs cursor-pointer transition ${
                  fbPages.length > 0 ? 'bg-[#1877F2] ring-2 ring-blue-300' : 'bg-gray-300 hover:bg-[#1877F2]'
                }`}
              >
                <FaFacebook />
              </button>

              {/* Plus Button */}
              <button
                onClick={() => setChannelModalOpen(true)}
                title="Connect more channels"
                className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer Widgets */}
        <div className="p-3 space-y-3">
          
          {/* "0/3 channels connected" Card */}
          {!channelWidgetDismissed && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 relative">
              <button
                onClick={() => setChannelWidgetDismissed(true)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <p className="text-xs font-semibold text-gray-800 mb-2">
                {connectedCount}/3 channels connected
              </p>
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#a6e59a] h-full transition-all" 
                  style={{ width: `${Math.min(100, (connectedCount / 3) * 100)}%` }} 
                />
              </div>
            </div>
          )}

          {/* User Organization Widget with Dropdown */}
          <div className="relative">
            <div
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-bold text-gray-900 truncate">My organization</p>
                  <p className="text-[11px] text-gray-400 truncate">Free Plan</p>
                </div>
              </div>

              <div className="text-gray-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>

            {/* User Dropdown */}
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 z-50 text-xs">
                <div className="px-3 py-2 border-b border-gray-100 mb-1">
                  <p className="font-bold text-gray-900 truncate">{user.name || 'Admin'}</p>
                  <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                </div>

                <button
                  onClick={onGoToLanding}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  View Public Website
                </button>

                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>

        </div>

      </aside>

      {/* ======================= MAIN CONTENT ======================= */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Greeting Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👏</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Good Afternoon, {displayGreetingUser}!
                </h1>
                <p className="text-xs font-semibold text-gray-400 mt-0.5">
                  {formattedDate}
                </p>
              </div>
            </div>

            {/* Top Right Icon */}
            <div className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition cursor-pointer">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>

          {/* Top Stats Card (Matching Screenshot exactly) */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            
            {/* 3 Metric Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 p-6 py-7">
              
              {/* Metric 1: Week Streak */}
              <div className="flex items-center gap-4 px-4">
                <div className="w-11 h-11 rounded-full bg-[#f2f2f2] text-gray-900 font-bold text-base flex items-center justify-center shrink-0">
                  0
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  <span>Week Streak</span>
                  <Info className="w-3.5 h-3.5 text-gray-400 cursor-pointer" />
                </div>
              </div>

              {/* Metric 2: Posting Goals */}
              <div className="flex items-center gap-4 px-4 pt-4 md:pt-0">
                <div className="w-11 h-11 rounded-full bg-[#f2f2f2] text-gray-900 font-bold text-base flex items-center justify-center shrink-0">
                  0
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  <span>Posting Goals</span>
                  <Info className="w-3.5 h-3.5 text-gray-400 cursor-pointer" />
                </div>
              </div>

              {/* Metric 3: Comment Score */}
              <div className="flex items-center gap-4 px-4 pt-4 md:pt-0">
                <div className="w-11 h-11 rounded-full bg-[#f2f2f2] text-gray-900 font-bold text-base flex items-center justify-center shrink-0">
                  0
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  <span>Comment Score</span>
                  <Info className="w-3.5 h-3.5 text-gray-400 cursor-pointer" />
                </div>
              </div>

            </div>

            {/* Blue Banner at Bottom */}
            <div 
              onClick={() => setChannelModalOpen(true)}
              className="bg-[#ebf4fe] border-t border-blue-100 px-6 py-3 flex items-center gap-2.5 text-xs md:text-sm font-medium text-blue-800 cursor-pointer hover:bg-blue-100 transition"
            >
              <div className="w-4 h-4 rounded border border-blue-600 flex items-center justify-center text-[10px] font-bold text-blue-600 shrink-0">
                +
              </div>
              <span className="hover:underline">
                Connect a channel to start tracking your posting streak, set goals and more.
              </span>
            </div>

          </div>

          {/* First Steps Section */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">
              First Steps
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Card 1: Connect a channel */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-gray-900">1. Connect a channel</h3>
                    <div className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 text-[10px]">
                      {connectedCount > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : '✓'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Personalize your profile to make the most out of SocialHub.
                  </p>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => setChannelModalOpen(true)}
                    className="px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 hover:bg-gray-50 transition cursor-pointer"
                  >
                    + Connect Channel
                  </button>
                </div>
              </div>

              {/* Card 2: Create a post */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-gray-900">2. Create a post</h3>
                    <div className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 text-[10px]">
                      {postsHistory.length > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : '✓'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Schedule your first post in just a few clicks.
                  </p>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => { setComposerOpen(true); setPublishSuccess(null); setPublishError(null); }}
                    className="px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 hover:bg-gray-50 transition cursor-pointer"
                  >
                    ✎ Create Post
                  </button>
                </div>
              </div>

              {/* Card 3: Explore SocialHub API */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-gray-900">3. Explore SocialHub API</h3>
                    <div className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 text-[10px]">
                      ✓
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Connect to your agents, automation tools, and more.
                  </p>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => window.open(`${apiUrl}/api/health`, '_blank')}
                    className="px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 hover:bg-gray-50 transition cursor-pointer"
                  >
                    &lt;/&gt; Get Started
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Lower Grid: "Up Next" & "Comments" */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Up Next Column */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">Up Next</h3>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 min-h-[190px] shadow-sm flex flex-col items-center justify-center text-center">
                {postsHistory.length === 0 ? (
                  <>
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 mb-2">
                      <Calendar className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <p className="text-xs font-semibold text-gray-500">No scheduled posts</p>
                    <p className="text-[11px] text-gray-400 mt-1">Posts you create will show up here</p>
                  </>
                ) : (
                  <div className="w-full space-y-2 text-left">
                    {postsHistory.slice(0, 3).map((p) => (
                      <div key={p.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full ${p.channel === 'instagram' ? 'bg-[#E1306C]' : 'bg-[#1877F2]'}`} />
                          <p className="font-semibold text-gray-800 line-clamp-1">{p.message || 'Photo Post'}</p>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Published
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comments Column */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">Comments</h3>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 min-h-[190px] shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 mb-2">
                  <MessageSquare className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-xs font-semibold text-gray-500">No comments yet</p>
                <p className="text-[11px] text-gray-400 mt-1">Engage with your audience in real-time</p>
              </div>
            </div>

          </div>

        </div>

        {/* Floating Help Circle Button (Bottom Right) */}
        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => alert(`SocialHub AI Help:\nConnected Channels: ${connectedCount}\nLogged in as: ${user.email}`)}
            className="w-10 h-10 rounded-full bg-[#dbeafe] text-blue-600 flex items-center justify-center font-bold shadow-lg hover:bg-blue-200 transition cursor-pointer"
            title="Help"
          >
            ?
          </button>
        </div>

      </main>

      {/* ======================= POST COMPOSER MODAL ======================= */}
      {composerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-gray-900">Create Post</h3>
              <button onClick={() => setComposerOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* Channel Selectors */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Select Channels:
                </label>
                <div className="flex gap-3">
                  {/* Facebook Pill */}
                  <div
                    onClick={() => setPostToFb(!postToFb)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 transition cursor-pointer ${
                      postToFb ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    <FaFacebook className="text-[#1877F2] text-lg" />
                    <span className="text-xs">Facebook Page ({fbPages.length > 0 ? (fbPages[0].page_name || fbPages[0].name) : 'Connect first'})</span>
                  </div>

                  {/* Instagram Pill */}
                  <div
                    onClick={() => setPostToIg(!postToIg)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 transition cursor-pointer ${
                      postToIg ? 'border-pink-500 bg-pink-50 text-pink-900 font-bold' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    <FaInstagram className="text-[#E1306C] text-lg" />
                    <span className="text-xs">Instagram ({igAccounts.length > 0 ? `@${igAccounts[0].username}` : 'Connect first'})</span>
                  </div>
                </div>
              </div>

              {/* Text Area */}
              <div>
                <textarea
                  rows={4}
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="What would you like to share?"
                  className="w-full p-4 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>

              {/* Media Upload */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Attach Photo / Media {postToIg && <span className="text-rose-500">* (Required for Instagram)</span>}
                </label>

                <div className="border-2 border-dashed border-gray-200 hover:border-gray-400 rounded-2xl p-4 text-center cursor-pointer relative bg-gray-50/50">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-700">Click or drag image file</p>
                  <p className="text-[10px] text-gray-400">JPG, PNG, WebP</p>
                </div>

                <div className="mt-2.5">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Or enter public image URL (https://...)"
                    className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                {/* Preview */}
                {(imagePreview || imageUrl) && (
                  <div className="mt-3 p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={imagePreview || imageUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover border" />
                      <span className="text-xs font-semibold text-gray-700 truncate max-w-[250px]">{imageFile ? imageFile.name : imageUrl}</span>
                    </div>
                    <button onClick={() => { setImageFile(null); setImagePreview(null); setImageUrl(''); }} className="text-xs text-rose-600 font-bold hover:underline">
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Alerts */}
              {publishSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{publishSuccess}</span>
                </div>
              )}

              {publishError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{publishError}</span>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <span className="text-xs text-gray-400">{postText.length} characters</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setComposerOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="px-5 py-2 bg-[#a6e59a] hover:bg-[#95d489] disabled:opacity-50 text-gray-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sharing...</span>
                    </>
                  ) : (
                    <span>Share Now</span>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================= CONNECT CHANNELS MODAL ======================= */}
      <ConnectNewChannelModal
        isOpen={channelModalOpen}
        onClose={() => setChannelModalOpen(false)}
        apiUrl={apiUrl}
        fbPages={fbPages}
        igAccounts={igAccounts}
        onChannelConnected={loadChannels}
      />

    </div>
  );
}
