import React, { useState } from 'react';
import { X, Check, Loader2, ChevronRight } from 'lucide-react';
import { FaFacebook, FaInstagram } from 'react-icons/fa6';

export interface FacebookPageOption {
  id: string;
  name: string;
  category: string;
  hasInstagram: boolean;
  instagram: { id: string; username: string } | null;
}

export interface InstagramAccountOption {
  id: string;
  username: string;
  name: string;
  profile_picture_url: string | null;
  page_name: string | null;
}

interface AccountPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: 'facebook' | 'instagram';
  pendingKey: string;
  facebookPages?: FacebookPageOption[];
  instagramAccounts?: InstagramAccountOption[];
  apiUrl: string;
  onConnected: () => void;
}

export function AccountPickerModal({
  isOpen,
  onClose,
  platform,
  pendingKey,
  facebookPages = [],
  instagramAccounts = [],
  apiUrl,
  onConnected,
}: AccountPickerModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const isFacebook = platform === 'facebook';
  const items = isFacebook ? facebookPages : instagramAccounts;
  const isEmpty = items.length === 0;

  const handleConnect = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);

    try {
      const endpoint = isFacebook
        ? `${apiUrl}/api/facebook/pages/select`
        : `${apiUrl}/api/instagram/accounts/select`;

      const body = isFacebook
        ? { pendingKey, pageId: selectedId }
        : { pendingKey, accountId: selectedId };

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to connect account.');
      }

      setSuccess(true);
      setTimeout(() => {
        onConnected();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3 shrink-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${isFacebook ? 'bg-[#1877F2]' : 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]'}`}>
            {isFacebook ? <FaFacebook className="w-5 h-5" /> : <FaInstagram className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">
              {isFacebook ? 'Select a Facebook Page' : 'Select an Instagram Account'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isFacebook
                ? 'Choose which page you want to connect to SocialHub AI'
                : 'Choose which account you want to connect to SocialHub AI'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {isEmpty ? (
            <div className="py-10 text-center text-gray-400">
              <p className="text-xs font-semibold">No accounts found.</p>
              <p className="text-[11px] mt-1">Please reconnect and try again.</p>
            </div>
          ) : isFacebook ? (
            facebookPages.map((page) => (
              <button
                key={page.id}
                onClick={() => setSelectedId(page.id)}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 text-left transition cursor-pointer ${
                  selectedId === page.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {/* FB avatar */}
                <div className="w-10 h-10 rounded-xl bg-[#1877F2] text-white flex items-center justify-center font-bold text-base shrink-0">
                  {page.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{page.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{page.category}</p>
                  {page.instagram && (
                    <p className="text-[11px] text-pink-500 mt-0.5 flex items-center gap-1">
                      <FaInstagram className="inline" />
                      <span>@{page.instagram.username}</span>
                    </p>
                  )}
                </div>

                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                  selectedId === page.id
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300'
                }`}>
                  {selectedId === page.id && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </button>
            ))
          ) : (
            instagramAccounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => setSelectedId(acc.id)}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 text-left transition cursor-pointer ${
                  selectedId === acc.id
                    ? 'border-pink-500 bg-pink-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {/* IG avatar */}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white flex items-center justify-center font-bold text-base shrink-0 ${acc.profile_picture_url ? 'p-0 overflow-hidden' : ''}`}>
                  {acc.profile_picture_url
                    ? <img src={acc.profile_picture_url} alt={acc.username} className="w-full h-full object-cover" />
                    : acc.username.charAt(0).toUpperCase()
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">@{acc.username}</p>
                  {acc.name && acc.name !== acc.username && (
                    <p className="text-[11px] text-gray-400 truncate">{acc.name}</p>
                  )}
                  {acc.page_name && (
                    <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                      <FaFacebook className="text-[#1877F2]" />
                      {acc.page_name}
                    </p>
                  )}
                </div>

                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                  selectedId === acc.id
                    ? 'border-pink-500 bg-pink-500'
                    : 'border-gray-300'
                }`}>
                  {selectedId === acc.id && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 pb-5 pt-2 border-t border-gray-100 flex items-center gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={!selectedId || saving || success}
            className={`flex-1 py-2.5 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              success
                ? 'bg-emerald-500 text-white'
                : isFacebook
                  ? 'bg-[#1877F2] hover:bg-[#166fe5] text-white disabled:opacity-40'
                  : 'bg-gradient-to-r from-[#f09433] to-[#bc1888] text-white disabled:opacity-40'
            }`}
          >
            {success ? (
              <><Check className="w-3.5 h-3.5 stroke-[3]" /> Connected!</>
            ) : saving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting...</>
            ) : (
              <>Connect<ChevronRight className="w-3.5 h-3.5" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
