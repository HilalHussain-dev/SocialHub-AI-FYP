import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export function AISection() {
  return (
    <section className="py-20 md:py-28 bg-[#111] text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs font-semibold text-white/70 mb-8">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Buffer MCP + AI Agents
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6 leading-[1.08]">
              Plan, post, and learn,<br />
              <span className="text-amber-400">right from your AI assistant</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-10">
              Connect Buffer to Claude, ChatGPT, or any MCP-compatible AI. Pull real performance data, plan your content calendar, and post directly — all in natural language.
            </p>
            <div className="space-y-5">
              {[
                { label: 'Ask', desc: 'Pull real Buffer performance data into any AI chat', num: '01' },
                { label: 'Plan', desc: 'Convert insights to content ideas in seconds', num: '02' },
                { label: 'Post', desc: 'Send directly to your Buffer queue without leaving your AI', num: '03' },
              ].map((step) => (
                <div key={step.label} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-xs font-mono font-bold text-amber-400 shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <div className="font-bold text-white mb-0.5">{step.label}</div>
                    <div className="text-sm text-gray-400">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <a href="#" className="inline-flex items-center gap-2 mt-10 bg-amber-400 text-[#111] text-sm font-bold px-6 py-3 rounded-xl hover:bg-amber-300 transition-colors">
              Learn about Buffer MCP <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Chat mock */}
          <div className="bg-[#1a1a1a] rounded-3xl border border-white/10 p-6 font-mono text-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-gray-500 font-sans">Claude · Buffer MCP</span>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center text-[11px] font-bold text-[#111] shrink-0">U</div>
                <div className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-xs text-gray-300 leading-relaxed">
                  What were my top 3 posts this month on LinkedIn? And suggest 5 new ideas based on them.
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-[#D97706] flex items-center justify-center text-[10px] font-bold text-white shrink-0">B</div>
                <div className="bg-[#252525] rounded-2xl rounded-tl-sm px-4 py-3 text-xs text-gray-300 leading-relaxed space-y-2">
                  <p className="text-amber-400 font-sans font-semibold text-[11px]">Fetching from Buffer analytics…</p>
                  <p>Your top LinkedIn posts in September:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-400">
                    <li>"5 async rituals that tripled team output" — 2,847 impressions</li>
                    <li>"Stop using Zoom for everything" — 1,923 impressions</li>
                    <li>"What 4 years remote taught me" — 1,604 impressions</li>
                  </ol>
                  <p className="text-gray-500 pt-1">Based on these, here are 5 content ideas:</p>
                  <ol className="list-decimal list-inside space-y-1 text-amber-400/80">
                    <li>The async toolkit we actually use</li>
                    <li>Meeting-free Fridays — a 3-month review</li>
                    <li>Remote onboarding, done right</li>
                    <li>The tool we deleted to gain 2 hours/day</li>
                    <li>How we write docs instead of holding meetings</li>
                  </ol>
                  <div className="flex gap-2 pt-2">
                    <button className="bg-amber-400 text-[#111] text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-amber-300 transition-colors font-sans">
                      Add to Buffer queue
                    </button>
                    <button className="bg-white/10 text-gray-300 text-[10px] px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors font-sans">
                      Expand on idea #1
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
