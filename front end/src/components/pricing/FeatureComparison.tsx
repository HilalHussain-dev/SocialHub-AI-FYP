import React from 'react';
import { Check } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Content creation',
    features: [
      { name: 'Ideas', desc: 'Capture and store content ideas whenever they come to you.', free: '100 IDEAS', essentials: 'UNLIMITED', team: 'UNLIMITED' },
      { name: 'Tags', desc: 'Save and organize your content by campaign or topic.', free: '3 TAGS', essentials: '250 TAGS', team: '250 TAGS' },
      { name: 'Drafts', desc: 'Capture and store content ideas whenever they come to you.', free: 'UNLIMITED', essentials: 'UNLIMITED', team: 'UNLIMITED' },
      { name: 'Templates', desc: 'Social post ideas to spark inspiration', free: true, essentials: true, team: true },
      { name: 'AI Assistant', desc: 'Refine and repurpose your content using AI. Unlimited credits.', free: true, essentials: true, team: true },
    ]
  },
  {
    title: 'Publishing',
    features: [
      { name: 'Scheduled posts per channel', desc: 'The number of scheduled posts per channel at one time.', free: '10', essentials: 'UNLIMITED', team: 'UNLIMITED' },
      { name: 'Threaded posts', desc: 'Publish threads to X, Bluesky, Threads, and Mastodon.', free: '1', essentials: 'UNLIMITED', team: 'UNLIMITED' },
      { name: 'Queue', desc: 'Create a queue of posts that you can re-arrange or shuffle.', free: true, essentials: true, team: true },
      { name: 'First comment scheduling', desc: 'Schedule a first comment with your Instagram, Facebook, or LinkedIn posts.', free: false, essentials: true, team: true },
    ]
  },
  {
    title: 'Analytics',
    features: [
      { name: 'Insights', desc: 'Follower growth, engagement, impressions, and post performance.', free: '30-DAY HISTORY', essentials: 'UNLIMITED', team: 'UNLIMITED' },
      { name: 'Performance overview', desc: 'A summary of posts, likes, comments, impressions, shares.', free: false, essentials: true, team: true },
      { name: 'Reports', desc: 'Export your data as CSV, PDF, or markdown to use anywhere.', free: false, essentials: true, team: true },
    ]
  }
];

export function FeatureComparison() {
  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 mb-24 font-sans">
      <div className="grid grid-cols-4 gap-4 mb-8 items-end">
        <div className="col-span-1">
          <h2 className="text-[34px] leading-tight font-extrabold text-gray-900 tracking-tight">Feature<br/>comparison</h2>
        </div>
        <div className="text-center px-2">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Free</h3>
          <button className="border border-gray-300 rounded-full w-full py-2 text-[15px] font-semibold text-gray-800 hover:bg-gray-50 transition-colors">Let's go &rarr;</button>
        </div>
        <div className="text-center relative px-2">
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#d1fae5] text-[#047857] text-[11px] font-bold px-3 py-1 rounded-full border border-[#a7f3d0] whitespace-nowrap">
            Recommended
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Essentials</h3>
          <button className="border border-gray-300 rounded-full w-full py-2 text-[15px] font-semibold text-gray-800 hover:bg-gray-50 transition-colors">Start 14-day free trial &rarr;</button>
        </div>
        <div className="text-center px-2">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Team</h3>
          <button className="border border-gray-300 rounded-full w-full py-2 text-[15px] font-semibold text-gray-800 hover:bg-gray-50 transition-colors">Start 14-day free trial &rarr;</button>
        </div>
      </div>

      <div className="border border-gray-200 overflow-hidden">
        {SECTIONS.map((section, idx) => (
          <div key={idx}>
            <div className="bg-[#2D332A] text-white py-3 px-6 font-semibold text-[15px]">
              {section.title}
            </div>
            <div className="divide-y divide-gray-100">
              {section.features.map((feat, fIdx) => (
                <div key={fIdx} className="grid grid-cols-4 hover:bg-gray-50 transition-colors group">
                  <div className="p-5 border-r border-gray-100">
                    <div className="font-semibold text-gray-900 text-[15px] mb-1">{feat.name}</div>
                    <div className="text-[13px] text-gray-500 leading-snug">{feat.desc}</div>
                  </div>
                  <div className="p-4 border-r border-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700 text-center">
                    {feat.free === true ? <Check className="w-5 h-5 text-gray-900" /> : feat.free === false ? '' : feat.free}
                  </div>
                  <div className="p-4 border-r border-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700 text-center bg-gray-50/30 group-hover:bg-transparent">
                    {feat.essentials === true ? <Check className="w-5 h-5 text-gray-900" /> : feat.essentials === false ? '' : feat.essentials}
                  </div>
                  <div className="p-4 flex items-center justify-center text-sm font-semibold text-gray-700 text-center">
                    {feat.team === true ? <Check className="w-5 h-5 text-gray-900" /> : feat.team === false ? '' : feat.team}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
