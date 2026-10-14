import React from 'react';
import { ArrowRight } from 'lucide-react';

const RESOURCES = [
  {
    title: 'Free Marketing Tools',
    desc: 'Generators, calculators, and utilities for social media professionals.',
    tag: 'Tools',
    img: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=480&h=280&fit=crop&auto=format',
  },
  {
    title: 'Social Media Glossary',
    desc: 'Every term you\'ll ever need — from algorithm to zero-click content.',
    tag: 'Reference',
    img: 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=480&h=280&fit=crop&auto=format',
  },
  {
    title: 'Social Media Marketing 101',
    desc: 'The complete beginner\'s guide to building a presence that grows.',
    tag: 'Guide',
    img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=480&h=280&fit=crop&auto=format',
  },
  {
    title: 'Best Time to Post',
    desc: 'Data-backed posting time guides for every major platform.',
    tag: 'Research',
    img: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=480&h=280&fit=crop&auto=format',
  },
  {
    title: 'Social Media Resources',
    desc: 'Templates, checklists, and swipe files to level up your strategy.',
    tag: 'Templates',
    img: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=480&h=280&fit=crop&auto=format',
  },
];

export function Resources() {
  return (
    <section className="py-20 border-t border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              Resources to help you grow
            </h2>
            <p className="text-gray-500 mt-2">Guides, tools, and research — all free.</p>
          </div>
          <a href="#" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:gap-2.5 transition-all">
            Browse all resources <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {RESOURCES.map((r, i) => (
            <a key={i} href="#" className={`group rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all ${i === 0 ? 'sm:col-span-2' : ''}`}>
              <div className="aspect-video bg-gray-100 overflow-hidden">
                <img
                  src={r.img}
                  alt={r.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">{r.tag}</span>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5 leading-snug">{r.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{r.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
