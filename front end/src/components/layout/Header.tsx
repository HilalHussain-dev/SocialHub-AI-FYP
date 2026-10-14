import React from 'react';
import { Search, Bell, Plus, Menu } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        <button className="md:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="hidden md:flex relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search campaigns, posts, or tags..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-100/50 border-none rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <button className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors shadow-sm shadow-blue-600/20">
          <Plus className="w-4 h-4" />
          Create Post
        </button>
      </div>
    </header>
  );
}
