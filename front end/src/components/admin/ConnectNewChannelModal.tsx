import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Store, 
  Contact, 
  Check, 
  Loader2, 
  ExternalLink,
  Send
} from 'lucide-react';
import { 
  FaFacebookF, 
  FaInstagram, 
  FaLinkedinIn, 
  FaYoutube, 
  FaTiktok, 
  FaPinterestP, 
  FaXTwitter, 
  FaMastodon 
} from 'react-icons/fa6';
import { SiThreads, SiBluesky, SiSubstack } from 'react-icons/si';

export interface FacebookPage {
  page_id?: string;
  id?: string;
  page_name?: string;
  name?: string;
  category?: string;
}

export interface InstagramAccount {
  id?: string;
  instagram_business_id?: string;
  username: string;
  name?: string;
}

interface ConnectNewChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiUrl: string;
  fbPages: FacebookPage[];
  igAccounts: InstagramAccount[];
  onChannelConnected?: () => void;
}

export function ConnectNewChannelModal({
  isOpen,
  onClose,
  apiUrl,
  fbPages,
  igAccounts,
  onChannelConnected,
}: ConnectNewChannelModalProps) {
  const [requestChannelOpen, setRequestChannelOpen] = useState(false);
  const [requestedChannelName, setRequestedChannelName] = useState('');
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [infoModal, setInfoModal] = useState<{ title: string; subtitle: string; icon: React.ReactNode; color: string } | null>(null);
  
  // Switcher modal states
  const [fbSwitcherOpen, setFbSwitcherOpen] = useState(false);
  const [igSwitcherOpen, setIgSwitcherOpen] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const isFbConnected = fbPages.length > 0;
  const isIgConnected = igAccounts.length > 0;

  const handleSelectChannel = (channelId: string) => {
    switch (channelId) {
      case 'facebook':
        if (fbPages.length > 1) {
          setFbSwitcherOpen(true);
        } else {
          window.location.href = `${apiUrl}/api/auth/facebook/connect`;
        }
        break;
      case 'instagram':
        if (igAccounts.length > 1) {
          setIgSwitcherOpen(true);
        } else {
          window.location.href = `${apiUrl}/api/auth/instagram/connect`;
        }
        break;
      case 'request':
        setRequestChannelOpen(true);
        break;
      default: {
        const found = channels.find((c) => c.id === channelId);
        if (found) {
          setInfoModal({
            title: found.name,
            subtitle: found.desc,
            icon: found.icon,
            color: found.colorBg
          });
        }
        break;
      }
    }
  };

  const handleActivateFbPage = async (pageId: string) => {
    setActivatingId(pageId);
    try {
      const res = await fetch(`${apiUrl}/api/facebook/pages/activate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      });
      if (res.ok) {
        if (onChannelConnected) onChannelConnected();
        setFbSwitcherOpen(false);
      }
    } catch (err) {
      console.error('Error activating FB page:', err);
    } finally {
      setActivatingId(null);
    }
  };

  const handleActivateIgAccount = async (accountId: string) => {
    setActivatingId(accountId);
    try {
      const res = await fetch(`${apiUrl}/api/instagram/accounts/activate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (res.ok) {
        if (onChannelConnected) onChannelConnected();
        setIgSwitcherOpen(false);
      }
    } catch (err) {
      console.error('Error activating IG account:', err);
    } finally {
      setActivatingId(null);
    }
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedChannelName.trim()) return;
    setRequestSubmitted(true);
    setTimeout(() => {
      setRequestSubmitted(false);
      setRequestedChannelName('');
      setRequestChannelOpen(false);
    }, 2000);
  };

  const channels = [
    {
      id: 'instagram',
      name: 'Instagram',
      desc: 'Business, Creator, or Personal',
      icon: <FaInstagram className="w-5 h-5 text-white" />,
      colorBg: 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]',
      connected: isIgConnected,
      connectedLabel: isIgConnected ? `@${igAccounts[0]?.username}` : undefined
    },
    {
      id: 'threads',
      name: 'Threads',
      desc: 'Profile',
      icon: <SiThreads className="w-5 h-5 text-white" />,
      colorBg: 'bg-black text-white',
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      desc: 'Page or Profile',
      icon: <FaLinkedinIn className="w-5 h-5 text-white" />,
      colorBg: 'bg-[#0A66C2]',
    },
    {
      id: 'facebook',
      name: 'Facebook',
      desc: 'Page or Group',
      icon: <FaFacebookF className="w-5 h-5 text-white" />,
      colorBg: 'bg-[#1877F2]',
      connected: isFbConnected,
      connectedLabel: isFbConnected ? (fbPages[0]?.page_name || fbPages[0]?.name) : undefined
    },
    {
      id: 'bluesky',
      name: 'Bluesky',
      desc: 'Profile',
      icon: <SiBluesky className="w-5 h-5 text-white" />,
      colorBg: 'bg-[#0285FF]',
    },
    {
      id: 'substack',
      name: 'Substack',
      desc: 'Profile',
      icon: <SiSubstack className="w-4 h-4 text-white" />,
      colorBg: 'bg-[#FF6719]',
      badge: 'New',
    },
    {
      id: 'youtube',
      name: 'YouTube',
      desc: 'Channel',
      icon: <FaYoutube className="w-5 h-5 text-white" />,
      colorBg: 'bg-[#FF0000]',
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      desc: 'Business or Personal',
      icon: <FaTiktok className="w-5 h-5 text-white" />,
      colorBg: 'bg-black text-white',
    },
    {
      id: 'mastodon',
      name: 'Mastodon',
      desc: 'Profile',
      icon: <FaMastodon className="w-5 h-5 text-white" />,
      colorBg: 'bg-[#6364FF]',
    },
    {
      id: 'pinterest',
      name: 'Pinterest',
      desc: 'Business or Profile',
      icon: <FaPinterestP className="w-5 h-5 text-white" />,
      colorBg: 'bg-[#E60023]',
    },
    {
      id: 'google-business',
      name: 'Google Business',
      desc: 'Profile',
      icon: <Store className="w-5 h-5 text-white" />,
      colorBg: 'bg-[#4285F4]',
    },
    {
      id: 'twitter',
      name: 'Twitter / X',
      desc: 'Profile',
      icon: <FaXTwitter className="w-5 h-5 text-white" />,
      colorBg: 'bg-black text-white',
    },
    {
      id: 'start-page',
      name: 'Start Page',
      desc: 'Simple, powerful link-in-bio',
      icon: <Contact className="w-5 h-5 text-white" />,
      colorBg: 'bg-[#10B981]',
    },
    {
      id: 'request',
      name: "Can't find it?",
      desc: 'Request a channel',
      icon: <Plus className="w-5 h-5 text-gray-800 stroke-[2.5]" />,
      colorBg: 'bg-gray-100 border border-gray-200',
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-gray-200/80 flex flex-col max-h-[88vh] overflow-hidden transition-all transform scale-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-gray-100 flex items-center justify-center shrink-0">
          <h2 id="modal-title" className="text-base sm:text-lg font-bold text-gray-900 tracking-tight text-center">
            Connect a New Channel
          </h2>
          
          <button
            onClick={onClose}
            className="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Channels Grid */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4.5">
            {channels.map((channel) => (
              <div
                key={channel.id}
                onClick={() => handleSelectChannel(channel.id)}
                className="relative bg-white border border-gray-200/90 hover:border-gray-300 rounded-2xl p-6 py-7 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group"
              >
                {/* "New" Badge for Substack */}
                {channel.badge && (
                  <span className="absolute top-3.5 right-3.5 text-[10px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full tracking-wide">
                    {channel.badge}
                  </span>
                )}

                {/* Channel Icon Box */}
                <div 
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3.5 shadow-xs group-hover:scale-105 transition-transform duration-150 ${channel.colorBg}`}
                >
                  {channel.icon}
                </div>

                {/* Channel Name */}
                <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {channel.name}
                </h3>

                {/* Channel Description */}
                <p className="text-xs text-gray-500 font-normal leading-snug mt-1">
                  {channel.desc}
                </p>

                {/* Connected status badge if already connected */}
                {channel.connected && (
                  <div className="mt-2.5 flex flex-col items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      <Check className="w-3 h-3 stroke-[3]" />
                      {channel.connectedLabel ? `Connected (${channel.connectedLabel})` : 'Connected'}
                    </span>
                    {((channel.id === 'facebook' && fbPages.length > 1) || (channel.id === 'instagram' && igAccounts.length > 1)) && (
                      <span className="text-[10px] text-blue-600 font-semibold hover:underline">
                        Switch active ({channel.id === 'facebook' ? fbPages.length : igAccounts.length} available)
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Facebook Page Switcher Modal */}
      {fbSwitcherOpen && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setFbSwitcherOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-200 space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1877F2] text-white flex items-center justify-center">
                  <FaFacebookF className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Switch Facebook Page</h3>
                  <p className="text-[11px] text-gray-400">Select which connected page you want to use</p>
                </div>
              </div>
              <button onClick={() => setFbSwitcherOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of Pages */}
            <div className="max-h-60 overflow-y-auto space-y-2 py-1">
              {fbPages.map((page, idx) => {
                const pageId = page.page_id || page.id || '';
                const pageName = page.page_name || page.name || 'Unnamed Page';
                const isActive = idx === 0;
                const isActivating = activatingId === pageId;

                return (
                  <button
                    key={pageId || idx}
                    onClick={() => handleActivateFbPage(pageId)}
                    disabled={isActivating || isActive}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition ${
                      isActive 
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold'
                        : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#1877F2] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {pageName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs truncate">{pageName}</p>
                        {page.category && <p className="text-[10px] text-gray-400 truncate">{page.category}</p>}
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isActivating ? (
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      ) : isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="text-[11px] text-blue-600 font-semibold hover:underline">Select</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
              <button
                onClick={() => {
                  window.location.href = `${apiUrl}/api/auth/facebook/connect`;
                }}
                className="w-full py-2 px-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Connect / Authorize more pages with Meta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instagram Account Switcher Modal */}
      {igSwitcherOpen && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setIgSwitcherOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-200 space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white flex items-center justify-center">
                  <FaInstagram className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Switch Instagram Account</h3>
                  <p className="text-[11px] text-gray-400">Select which connected account you want to use</p>
                </div>
              </div>
              <button onClick={() => setIgSwitcherOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of Accounts */}
            <div className="max-h-60 overflow-y-auto space-y-2 py-1">
              {igAccounts.map((account, idx) => {
                const accountId = account.instagram_business_id || account.id || '';
                const username = account.username;
                const isActive = idx === 0;
                const isActivating = activatingId === accountId;

                return (
                  <button
                    key={accountId || idx}
                    onClick={() => handleActivateIgAccount(accountId)}
                    disabled={isActivating || isActive}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition ${
                      isActive 
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold'
                        : 'border-gray-200 hover:border-pink-400 hover:bg-pink-50/30 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {username ? username.charAt(0).toUpperCase() : 'I'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs truncate">@{username}</p>
                        {account.name && <p className="text-[10px] text-gray-400 truncate">{account.name}</p>}
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isActivating ? (
                        <Loader2 className="w-4 h-4 text-pink-600 animate-spin" />
                      ) : isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="text-[11px] text-pink-600 font-semibold hover:underline">Select</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
              <button
                onClick={() => {
                  window.location.href = `${apiUrl}/api/auth/instagram/connect`;
                }}
                className="w-full py-2 px-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Connect / Authorize more accounts with Meta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info / Connect Channel Sub-Modal for other channels */}
      {infoModal && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setInfoModal(null)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-200 text-center space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${infoModal.color}`}>
              {infoModal.icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{infoModal.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{infoModal.subtitle}</p>
            </div>
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 text-left">
              <p className="font-semibold mb-1">Channel Integration</p>
              <p className="text-blue-700 leading-relaxed">
                Connect your {infoModal.title} account to schedule posts, analyze engagement, and streamline your workflow directly from SocialHub.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setInfoModal(null)}
                className="flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert(`${infoModal.title} integration is ready to connect with your API credentials.`);
                  setInfoModal(null);
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Authorize</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Channel Sub-Modal */}
      {requestChannelOpen && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setRequestChannelOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-200 space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-900">Request a Channel</h3>
              <button onClick={() => setRequestChannelOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {requestSubmitted ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h4 className="font-bold text-sm text-gray-900">Request Received!</h4>
                <p className="text-xs text-gray-500">Thank you for your feedback. We're continuously adding new channels.</p>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <p className="text-xs text-gray-500">
                  Tell us which social channel or platform you'd like to manage with SocialHub:
                </p>
                <div>
                  <input
                    type="text"
                    required
                    value={requestedChannelName}
                    onChange={(e) => setRequestedChannelName(e.target.value)}
                    placeholder="e.g. WhatsApp, Discord, Reddit, Lemon8..."
                    className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-900"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestChannelOpen(false)}
                    className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
