import React from 'react';
import { ExternalLink, ArrowRight } from 'lucide-react';

export function Support() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="bg-gray-50 rounded-3xl border border-gray-100 p-10 md:p-16 text-center">
          <div className="flex justify-center -space-x-2 mb-8">
            {['#6366f1','#f59e0b','#10b981','#f43f5e','#06b6d4','#8b5cf6'].map((c, i) => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white ring-2 ring-gray-50" style={{ backgroundColor: c }}>
                {['A','M','R','S','J','L'][i]}
              </div>
            ))}
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
            Human support, worldwide
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Real people, no bots. Our support team is distributed across 12 time zones so help is always close.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="#" className="inline-flex items-center gap-2 bg-[#1a1a1a] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors">
              Visit the Help Center <ExternalLink className="w-4 h-4" />
            </a>
            <a href="#" className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors">
              Join our Discord <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
