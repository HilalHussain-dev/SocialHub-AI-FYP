import React, { useState } from 'react';
import { Calendar, Edit3, MessageSquare, BarChart3, ArrowRight } from 'lucide-react';

const FEATURE_TABS = [
  {
    id: 'publish',
    label: 'Publish',
    icon: Calendar,
    headline: 'The most complete set of publishing integrations, ever',
    body: 'Schedule posts across every platform, collaborate with your team, and manage your entire content calendar from one clean dashboard. Work faster with AI-powered suggestions and a drag-and-drop queue.',
    tags: ['Instagram', 'TikTok', 'LinkedIn', 'X', 'Facebook', 'Pinterest', 'Threads', 'YouTube'],
    color: '#2563eb',
    mockBg: 'from-blue-50 to-indigo-50',
  },
  {
    id: 'create',
    label: 'Create',
    icon: Edit3,
    headline: 'Turn any idea into the perfect post',
    body: 'Brainstorm, draft, and refine content with an AI assistant that understands your brand voice. Transform long-form content into snappy social posts, or remix your best-performing content.',
    tags: ['AI writing', 'Idea generation', 'Post remix', 'Brand voice', 'Content repurposing'],
    color: '#7c3aed',
    mockBg: 'from-violet-50 to-purple-50',
  },
  {
    id: 'community',
    label: 'Community',
    icon: MessageSquare,
    headline: 'Reply to comments in a flash',
    body: 'Manage all your mentions, DMs, and comments across every platform in a single inbox. Build real relationships with your followers — without bouncing between six different apps.',
    tags: ['Unified inbox', 'Comment management', 'DM replies', 'Mention tracking'],
    color: '#059669',
    mockBg: 'from-emerald-50 to-green-50',
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: BarChart3,
    headline: 'Answers, not just analytics',
    body: 'Get plain-English performance summaries that tell you what\'s actually working. Find your best posting times, top content types, and audience growth patterns at a glance.',
    tags: ['Performance summaries', 'Best time to post', 'Audience growth', 'Content benchmarks'],
    color: '#db2777',
    mockBg: 'from-pink-50 to-rose-50',
  },
];

function PublishMock({ color }: { color: string }) {
  return (
    <div className="w-full h-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold" style={{ color }}>B</div>
        <div className="flex-1">
          <div className="h-3 bg-gray-100 rounded w-24 mb-1.5" />
          <div className="h-2.5 bg-gray-100 rounded w-16" />
        </div>
        <div className="h-7 px-3 rounded-full text-xs font-semibold text-white flex items-center" style={{ backgroundColor: color }}>
          + Add post
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[10px] text-gray-400 font-medium">
        {['M','T','W','T','F','S','S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1">
        {Array.from({ length: 28 }).map((_, i) => (
          <div key={i} className={`rounded aspect-square flex items-center justify-center text-[10px] font-medium ${i === 9 ? 'text-white' : 'text-gray-400'}`}
            style={i === 9 ? { backgroundColor: color } : { backgroundColor: i % 3 === 0 ? '#f9fafb' : 'transparent' }}>
            {i + 1}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[80, 60, 90].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gray-100 shrink-0" />
            <div className="flex-1 h-2.5 bg-gray-100 rounded" style={{ width: `${w}%` }} />
            <div className="w-12 h-5 rounded-full text-[10px] font-medium text-white flex items-center justify-center" style={{ backgroundColor: color }}>
              {['3pm', '5pm', '9am'][i]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateMock({ color }: { color: string }) {
  return (
    <div className="w-full h-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color }}>✦ AI Assistant</span>
        <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">3/5 ideas</span>
      </div>
      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 leading-relaxed">
        "Write 5 LinkedIn hooks about productivity for remote teams"
      </div>
      <div className="space-y-2.5 flex-1">
        {[
          'Stop scheduling meetings that could be emails. Here\'s what I do instead…',
          '5 async rituals that made our team 3× more productive:',
          'I\'ve worked remotely for 4 years. The #1 thing nobody tells you:',
        ].map((text, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed hover:border-gray-300 cursor-pointer transition-colors">
            {text}
            <div className="flex gap-2 mt-2">
              <button className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50">Use this</button>
              <button className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50">Rewrite</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunityMock({ color }: { color: string }) {
  const msgs = [
    { from: 'sarah_designs', msg: 'Love this post! Can you share more about your workflow?', time: '2m', platform: 'IG' },
    { from: 'growwithmark', msg: 'This is exactly what I needed to hear today 🙌', time: '5m', platform: 'LI' },
    { from: 'techfounder_', msg: 'Have you considered covering B2B use cases too?', time: '12m', platform: 'X' },
  ];
  return (
    <div className="w-full h-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">Inbox</span>
        <span className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: color }}>
          24 new
        </span>
      </div>
      <div className="flex gap-2">
        {['All', 'Comments', 'DMs', 'Mentions'].map((tab) => (
          <button key={tab} className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${tab === 'All' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
            style={tab === 'All' ? { backgroundColor: color } : {}}>
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        {msgs.map((m, i) => (
          <div key={i} className="flex gap-2.5 p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-500">
              {m.from[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-gray-800 truncate">@{m.from}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] text-gray-400">{m.time}</span>
                  <span className="text-[9px] px-1 py-px rounded bg-gray-100 font-medium text-gray-500">{m.platform}</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-0.5 leading-relaxed line-clamp-2">{m.msg}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsMock({ color }: { color: string }) {
  const bars = [42, 68, 55, 90, 73, 61, 85, 48, 92, 70, 58, 78];
  return (
    <div className="w-full h-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">Performance overview</span>
        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Last 30 days</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Impressions', value: '248K', delta: '+14%' },
          { label: 'Engagement', value: '5.2%', delta: '+2.1%' },
          { label: 'Followers', value: '+1,240', delta: '+8%' },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-2.5">
            <div className="text-[10px] text-gray-500 mb-1">{stat.label}</div>
            <div className="text-sm font-bold text-gray-900">{stat.value}</div>
            <div className="text-[10px] font-semibold" style={{ color }}>{stat.delta}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-end gap-1 pt-2">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all"
            style={{ height: `${h}%`, backgroundColor: i === 4 || i === 8 ? color : `${color}40` }}
          />
        ))}
      </div>
      <div className="text-[10px] text-gray-400 flex justify-between">
        <span>Sep 1</span><span>Sep 15</span><span>Sep 30</span>
      </div>
    </div>
  );
}

function FeatureMock({ tab, color }: { tab: typeof FEATURE_TABS[0]; color: string }) {
  if (tab.id === 'publish') return <PublishMock color={color} />;
  if (tab.id === 'create') return <CreateMock color={color} />;
  if (tab.id === 'community') return <CommunityMock color={color} />;
  return <InsightsMock color={color} />;
}

export function CoreFeatures() {
  const [activeTab, setActiveTab] = useState(0);
  const tab = FEATURE_TABS[activeTab];

  return (
    <section className="pt-8 pb-20 md:pt-10 md:pb-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
            Core features
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight max-w-2xl mx-auto">
            Everything you need to grow on social
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {FEATURE_TABS.map((t, i) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
                  activeTab === i
                    ? 'text-white border-transparent shadow-md'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'
                }`}
                style={activeTab === i ? { backgroundColor: t.color } : {}}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div>
            <h3 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-5 leading-tight">
              {tab.headline}
            </h3>
            <p className="text-gray-500 text-lg leading-relaxed mb-8">{tab.body}</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {tab.tags.map((t) => (
                <span key={t} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 bg-gray-50">
                  {t}
                </span>
              ))}
            </div>
            <a href="#" className="inline-flex items-center gap-2 font-semibold text-sm hover:gap-3 transition-all" style={{ color: tab.color }}>
              Explore {tab.label} <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Mock UI */}
          <div className={`relative bg-gradient-to-br ${tab.mockBg} rounded-3xl p-6 aspect-[4/3] overflow-hidden border border-white shadow-xl`}>
            <FeatureMock tab={tab} color={tab.color} />
            <div className="absolute -inset-px rounded-3xl ring-1 ring-inset ring-white/30" />
          </div>
        </div>
      </div>
    </section>
  );
}
