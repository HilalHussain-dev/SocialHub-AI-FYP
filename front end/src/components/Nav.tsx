import React, { useState, useEffect, useRef } from 'react';
import logo from '../assets/logo.png';
import {
  ChevronDown,
  Menu,
  X,
  LayoutGrid,
  Send,
  LineChart,
  MessageCircleHeart,
  Handshake,
  Link2,
  Wand2,
  Webhook,
  LucideIcon
} from 'lucide-react';
import {
  FaLinkedinIn, FaPinterestP, FaYoutube, FaXTwitter,
  FaGoogle, FaInstagram, FaMastodon, FaTiktok, FaFacebookF
} from 'react-icons/fa6';
import { SiBluesky, SiThreads, SiSubstack } from 'react-icons/si';

type MegaMenuItem = {
  icon?: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  href: string;
};

type IntegrationItem = {
  name: string;
  color: string;
  icon: React.ReactNode;
};

const INTEGRATION_CHANNELS: IntegrationItem[] = [
  { name: 'Instagram', color: '#E1306C', icon: <FaInstagram className="w-3.5 h-3.5 text-white" /> },
  { name: 'Facebook', color: '#1877F2', icon: <FaFacebookF className="w-3.5 h-3.5 text-white" /> },
  { name: 'TikTok', color: '#010101', icon: <FaTiktok className="w-3.5 h-3.5 text-white" /> },
  { name: 'LinkedIn', color: '#0A66C2', icon: <FaLinkedinIn className="w-3.5 h-3.5 text-white" /> },
  { name: 'X (Twitter)', color: '#1a1a1a', icon: <FaXTwitter className="w-3.5 h-3.5 text-white" /> },
  { name: 'YouTube', color: '#FF0000', icon: <FaYoutube className="w-3.5 h-3.5 text-white" /> },
  { name: 'Threads', color: '#1a1a1a', icon: <SiThreads className="w-3.5 h-3.5 text-white" /> },
  { name: 'Pinterest', color: '#E60023', icon: <FaPinterestP className="w-3.5 h-3.5 text-white" /> },
  { name: 'Google Business Profile', color: '#4285F4', icon: <FaGoogle className="w-3.5 h-3.5 text-white" /> },
  { name: 'Bluesky', color: '#0085FF', icon: <SiBluesky className="w-3 h-3 text-white" /> },
  { name: 'Mastodon', color: '#6364FF', icon: <FaMastodon className="w-3 h-3 text-white" /> },
  { name: 'Substack', color: '#FF6719', icon: <SiSubstack className="w-3 h-3 text-white" /> },
];

type NavItem = {
  label: string;
  isMegaMenu?: boolean;
  megaMenuType?: 'features' | 'integrations' | 'text-grid';
  children?: string[];
  megaMenuItems?: MegaMenuItem[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Features',
    isMegaMenu: true,
    megaMenuType: 'features',
    megaMenuItems: [
      {
        icon: LayoutGrid,
        title: 'Create',
        description: 'Build your own library of content ideas',
        href: '#',
      },
      {
        icon: Send,
        title: 'Publish',
        description: 'Plan and schedule your content across social media platforms',
        href: '#',
      },
      {
        icon: LineChart,
        title: 'Insights',
        description: 'Understand your performance and what to post next',
        badge: 'New',
        href: '#',
      },
      {
        icon: MessageCircleHeart,
        title: 'Community',
        description: 'Easily engage with your community',
        href: '#',
      },
      {
        icon: Handshake,
        title: 'Collaborate',
        description: 'Work together seamlessly, from planning to publishing',
        href: '#',
      },
      {
        icon: Link2,
        title: 'Start Page',
        description: 'Build a custom link-in-bio page in minutes',
        href: '#',
      },
      {
        icon: Wand2,
        title: 'AI Assistant',
        description: 'Get help creating, refining, and repurposing content',
        href: '#',
      },
      {
        icon: Webhook,
        title: 'API',
        description: 'Connect Buffer to your agents, automation tools, or build something entirely new',
        href: '#',
      },
    ],
  },
  {
    label: 'Integrations',
    isMegaMenu: true,
    megaMenuType: 'integrations',
  },
  {
    label: 'Made for',
    isMegaMenu: true,
    megaMenuType: 'text-grid',
    megaMenuItems: [
      {
        title: 'Creators',
        description: 'Grow your community with confidence, not complexity',
        href: '#',
      },
      {
        title: 'Small Business',
        description: "A simpler way to manage your small business' social media",
        href: '#',
      },
      {
        title: 'Agencies',
        description: "Run every client's social with clarity",
        href: '#',
      },
      {
        title: 'Nonprofits',
        description: 'Made for small teams doing big things',
        href: '#',
      },
      {
        title: 'Higher Education',
        description: 'Social media management built for schools and universities',
        href: '#',
      },
      {
        title: 'Developers',
        description: "Add a social layer for whatever you're building",
        href: '#',
      },
    ],
  },
  {
    label: 'Resources',
    isMegaMenu: true,
    megaMenuType: 'text-grid',
    megaMenuItems: [
      {
        title: 'Blog',
        description: 'Real-life stories and resources on growing an engaged audience',
        href: '#',
      },
      {
        title: 'Support',
        description: 'Help articles and tutorials to get the most out of Buffer',
        href: '#',
      },
      {
        title: 'Case Studies',
        description: 'How power users get more from Buffer.',
        href: '#',
      },
    ],
  },
];

function NavDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        className="flex items-center gap-1 text-[15px] font-medium text-gray-700 hover:text-gray-900 py-2 px-3"
        onClick={() => setOpen(!open)}
      >
        {item.label}
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] py-2 z-50 ${item.megaMenuType === 'features' ? 'w-[720px] p-4' :
              item.megaMenuType === 'integrations' ? 'w-[760px] p-6' :
                item.megaMenuType === 'text-grid' ? 'w-[640px] p-4' :
                  'w-52'
            }`}
        >
          {item.megaMenuType === 'features' && item.megaMenuItems && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {item.megaMenuItems.map((megaItem, index) => (
                <a
                  key={index}
                  href={megaItem.href}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#f7f7f7] transition-colors group"
                >
                  <div className="shrink-0 mt-0.5 text-gray-500 group-hover:text-gray-700 transition-colors">
                    {megaItem.icon && <megaItem.icon className="w-[18px] h-[18px]" strokeWidth={2} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 text-[15px] leading-none">
                        {megaItem.title}
                      </h3>
                      {megaItem.badge && (
                        <span className="px-1.5 py-0.5 text-[11px] font-medium bg-[#e6f4ea] text-[#137333] rounded uppercase tracking-wide leading-none">
                          {megaItem.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-gray-500 leading-snug">
                      {megaItem.description}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}

          {item.megaMenuType === 'text-grid' && item.megaMenuItems && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {item.megaMenuItems.map((megaItem, index) => (
                <a
                  key={index}
                  href={megaItem.href}
                  className="block p-3 rounded-xl hover:bg-[#f7f7f7] transition-colors group"
                >
                  <h3 className="font-semibold text-gray-900 text-[15px] mb-1">
                    {megaItem.title}
                  </h3>
                  <p className="text-[14px] text-gray-500 leading-snug">
                    {megaItem.description}
                  </p>
                </a>
              ))}
            </div>
          )}

          {item.megaMenuType === 'integrations' && (
            <div>
              <div className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-4 px-3">
                Channels
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                {INTEGRATION_CHANNELS.map((channel) => (
                  <a
                    key={channel.name}
                    href="#"
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#f7f7f7] transition-colors group"
                  >
                    <div
                      className="flex items-center justify-center w-6 h-6 rounded-md shadow-sm opacity-90 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: channel.color }}
                    >
                      {channel.icon}
                    </div>
                    <span className="font-semibold text-gray-800 text-[15px] group-hover:text-gray-900 transition-colors">
                      {channel.name}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {!item.isMegaMenu && item.children && (
            <div className="py-1">
              {item.children.map((child) => (
                <a
                  key={child}
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  {child}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface NavProps {
  user?: { id: string; email: string; name?: string } | null;
  onOpenAuth?: (mode: 'login' | 'register') => void;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
}

export function Nav({ user, onOpenAuth, onOpenAdmin, onLogout }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-white z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-[72px]">
          {/* Logo */}
          <div className="flex items-center gap-10">
            <a href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center">
                <img src={logo} alt="SocialHub Logo" className="w-8 h-8 object-contain" />
              </div>
              <span className="font-extrabold text-[22px] tracking-tight text-gray-900">SocialHub</span>
            </a>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavDropdown key={item.label} item={item} />
              ))}
              <a href="#pricing" className="text-[15px] font-medium text-gray-700 hover:text-gray-900 py-2 px-3">Pricing</a>
            </div>
          </div>

          {/* Right CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={onOpenAdmin}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-bold px-5 py-2.5 rounded-full transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  Admin Panel →
                </button>
                <button
                  onClick={onLogout}
                  className="text-[14px] font-semibold text-gray-600 hover:text-rose-600 border border-gray-200 rounded-full px-4 py-2 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onOpenAuth?.('login')}
                  className="text-[15px] font-semibold text-gray-800 border border-gray-400 rounded-full px-5 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Log in
                </button>
                <button
                  onClick={() => onOpenAuth?.('register')}
                  className="bg-[#a6e59a] text-gray-900 text-[15px] font-semibold px-5 py-2.5 rounded-full hover:bg-[#95d489] transition-colors cursor-pointer"
                >
                  Get started for free
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="lg:hidden p-2 text-gray-600 cursor-pointer" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3 shadow-lg h-screen overflow-y-auto pb-24">
          {NAV_ITEMS.map((item) => (
            <details key={item.label} className="group">
              <summary className="flex items-center justify-between py-2 text-[15px] font-medium text-gray-700 cursor-pointer list-none">
                {item.label}
                <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="ml-4 mt-1 space-y-1">
                {item.megaMenuType === 'features' && item.megaMenuItems
                  ? item.megaMenuItems.map((megaItem, idx) => (
                    <a key={idx} href={megaItem.href} className="block py-2 text-sm text-gray-600 hover:text-gray-900">
                      <div className="flex items-center gap-2">
                        {megaItem.icon && <megaItem.icon className="w-4 h-4" />}
                        <span className="font-medium">{megaItem.title}</span>
                        {megaItem.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#e6f4ea] text-[#137333] rounded uppercase">
                            {megaItem.badge}
                          </span>
                        )}
                      </div>
                    </a>
                  ))
                  : item.megaMenuType === 'text-grid' && item.megaMenuItems
                    ? item.megaMenuItems.map((megaItem, idx) => (
                      <a key={idx} href={megaItem.href} className="block py-2 text-sm text-gray-600 hover:text-gray-900">
                        <span className="font-medium">{megaItem.title}</span>
                      </a>
                    ))
                    : item.megaMenuType === 'integrations'
                      ? INTEGRATION_CHANNELS.map((channel, idx) => (
                        <a key={idx} href="#" className="block py-2 text-sm text-gray-600 hover:text-gray-900">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex items-center justify-center w-5 h-5 rounded-md"
                              style={{ backgroundColor: channel.color }}
                            >
                              {React.cloneElement(channel.icon as React.ReactElement<any>, { className: "w-3 h-3 text-white" })}
                            </div>
                            <span className="font-medium">{channel.name}</span>
                          </div>
                        </a>
                      ))
                      : item.children?.map((child) => (
                        <a key={child} href="#" className="block py-1.5 text-sm text-gray-600 hover:text-gray-900">
                          {child}
                        </a>
                      ))}
              </div>
            </details>
          ))}
          <a href="#pricing" className="block py-2 text-[15px] font-medium text-gray-700">Pricing</a>
          <div className="pt-4 flex flex-col gap-3 border-t border-gray-100">
            {user ? (
              <>
                <button
                  onClick={() => { setMobileOpen(false); onOpenAdmin?.(); }}
                  className="bg-blue-600 text-white text-[15px] font-bold px-5 py-2.5 rounded-full text-center"
                >
                  Admin Panel →
                </button>
                <button
                  onClick={() => { setMobileOpen(false); onLogout?.(); }}
                  className="text-[15px] font-semibold text-rose-600 border border-rose-200 rounded-full px-5 py-2.5 text-center"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setMobileOpen(false); onOpenAuth?.('login'); }}
                  className="text-[15px] font-semibold text-gray-800 border border-gray-400 rounded-full px-5 py-2.5 text-center hover:bg-gray-50 transition-colors"
                >
                  Log in
                </button>
                <button
                  onClick={() => { setMobileOpen(false); onOpenAuth?.('register'); }}
                  className="bg-[#a6e59a] text-gray-900 text-[15px] font-semibold px-5 py-2.5 rounded-full text-center hover:bg-[#95d489] transition-colors"
                >
                  Get started for free
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

