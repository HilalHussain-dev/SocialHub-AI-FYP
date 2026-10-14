import React from 'react';
import { 
  LayoutDashboard, 
  PenTool, 
  BarChart3, 
  Users, 
  Calendar,
  Settings,
  HelpCircle,
  Globe
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, current: true },
  { name: 'Publishing', icon: PenTool, current: false },
  { name: 'Analytics', icon: BarChart3, current: false },
  { name: 'Engagement', icon: Users, current: false },
  { name: 'Calendar', icon: Calendar, current: false },
];

const secondaryItems = [
  { name: 'Settings', icon: Settings },
  { name: 'Help & Support', icon: HelpCircle },
];

export function Sidebar() {
  return (
    <div className="flex flex-col h-full bg-white text-slate-700">
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <div className="flex items-center gap-2 text-blue-600">
          <Globe className="w-6 h-6 stroke-[2.5]" />
          <span className="font-bold text-xl tracking-tight text-slate-900">SocialHub AI</span>
        </div>
      </div>
      
      <div className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.name}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                item.current 
                  ? "bg-blue-50 text-blue-700" 
                  : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", item.current ? "text-blue-600" : "text-slate-400")} />
              {item.name}
            </button>
          ))}
        </div>
        
        <div>
          <h4 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Workspace
          </h4>
          <div className="space-y-1">
            {secondaryItems.map((item) => (
              <button
                key={item.name}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <item.icon className="w-5 h-5 text-slate-400" />
                {item.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-100">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-semibold shrink-0">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">Jane Doe</p>
            <p className="text-xs text-slate-500 truncate">jane@example.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
