import React from 'react';
import { connectFacebook } from "../../lib/facebook";
import { TrendingUp, Users, Eye, MessageSquare, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';
<button onClick={connectFacebook}>
  Connect Facebook
</button>

// SVG Icons for Social Platforms
const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 5.925H5.022z" />
  </svg>
);

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const chartData = [
  { name: 'Mon', audience: 4000, engagement: 2400 },
  { name: 'Tue', audience: 3000, engagement: 1398 },
  { name: 'Wed', audience: 2000, engagement: 9800 },
  { name: 'Thu', audience: 2780, engagement: 3908 },
  { name: 'Fri', audience: 1890, engagement: 4800 },
  { name: 'Sat', audience: 2390, engagement: 3800 },
  { name: 'Sun', audience: 3490, engagement: 4300 },
];

function StatCard({ title, value, change, icon: Icon, positive = true }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
          <Icon className="w-5 h-5" />
        </div>
        <span className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
          positive ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
        )}>
          {positive ? '+' : '-'}{Math.abs(change)}%
        </span>
      </div>
      <div>
        <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
        <p className="text-sm font-medium text-slate-500 mt-1">{title}</p>
      </div>
    </div>
  );
}

function SocialIcon({ platform }: { platform: 'twitter' | 'instagram' | 'linkedin' }) {
  const icons = {
    twitter: { icon: TwitterIcon, bg: 'bg-sky-50 text-sky-500' },
    instagram: { icon: InstagramIcon, bg: 'bg-fuchsia-50 text-fuchsia-500' },
    linkedin: { icon: LinkedinIcon, bg: 'bg-blue-50 text-blue-600' }
  };
  const { icon: Icon, bg } = icons[platform];
  return (
    <div className={cn("p-2 rounded-full", bg)}>
      <Icon className="w-4 h-4" />
    </div>
  );
}

export function Dashboard() {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, Jane! 👋</h1>
          <p className="text-slate-500 text-sm mt-1">Here's what's happening with your social accounts today.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-slate-500">Showing data for:</span>
          <select className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>This month</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="Total Audience" value="124.5K" change={12.5} icon={Users} />
        <StatCard title="Post Impressions" value="2.4M" change={8.2} icon={Eye} />
        <StatCard title="Total Engagement" value="48.2K" change={-2.4} icon={MessageSquare} positive={false} />
        <StatCard title="Audience Growth" value="+2,340" change={14.1} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-base font-bold text-slate-900">Audience Overview</h2>
              <p className="text-sm text-slate-500">Impressions and engagement over time</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line
                  type="monotone"
                  dataKey="audience"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="engagement"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Posts */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-slate-900">Upcoming Posts</h2>
            <button className="text-sm text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {[
              { time: 'Today, 2:00 PM', platform: 'twitter' as const, content: 'Excited to announce our new feature drop tomorrow! 🚀 #SaaS #BuildInPublic' },
              { time: 'Tomorrow, 9:00 AM', platform: 'linkedin' as const, content: 'We are hiring! Join our fast-growing engineering team in New York.' },
              { time: 'Thu, 11:30 AM', platform: 'instagram' as const, content: 'Behind the scenes at the SocialHub office today. 📸' },
            ].map((post, i) => (
              <div key={i} className="group p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <SocialIcon platform={post.platform} />
                    <span className="text-xs font-semibold text-slate-500">{post.time}</span>
                  </div>
                  <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Scheduled</span>
                </div>
                <p className="text-sm text-slate-700 line-clamp-2 mt-2 leading-relaxed">
                  {post.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
