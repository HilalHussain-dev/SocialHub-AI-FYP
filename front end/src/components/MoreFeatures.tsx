import React from 'react';
import { Users, Smartphone, Link, Sparkles, ArrowRight } from 'lucide-react';

const MORE_FEATURES = [
  {
    icon: Users,
    title: 'Collaborate',
    desc: 'Invite teammates, assign roles, and build approval workflows so the right content goes out every time.',
    color: '#2563eb',
  },
  {
    icon: Smartphone,
    title: 'Mobile app',
    desc: 'Schedule, respond, and review analytics from anywhere with the iOS and Android apps.',
    color: '#7c3aed',
  },
  {
    icon: Link,
    title: 'Start Page',
    desc: 'Build a beautiful link-in-bio hub that drives traffic to everything you create.',
    color: '#059669',
  },
  {
    icon: Sparkles,
    title: 'AI Assistant',
    desc: 'Brainstorm ideas, rewrite for tone, and craft scroll-stopping captions in seconds.',
    color: '#db2777',
  },
];

export function MoreFeatures() {
  return (
    <section className="py-20 bg-gray-50/80 border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
            …and so much more
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            A complete workspace for every part of your social media workflow.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {MORE_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-white rounded-2xl border border-gray-100 p-7 flex gap-5 hover:shadow-md transition-shadow group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${f.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                  <a href="#" className="inline-flex items-center gap-1 text-xs font-semibold mt-3 group-hover:gap-2 transition-all" style={{ color: f.color }}>
                    Learn more <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
