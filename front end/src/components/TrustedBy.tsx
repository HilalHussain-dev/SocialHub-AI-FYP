import React from 'react';

const LOGOS = [
  'Metallica', 'Benefit', 'Wired', 'Semrush', 'Crocs',
  'ElevenLabs', 'Pizza Hut', 'Vice', 'Shopify', 'Stripe',
];

export function TrustedBy() {
  const count = 267037;

  return (
    <section className="py-20 text-center overflow-hidden">
      {/* Social proof counter */}
      <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm mb-14">
        <div className="flex -space-x-2">
          {['#6366f1', '#f59e0b', '#10b981', '#f43f5e'].map((c, i) => (
            <div key={i} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: c }}>
              {['A', 'M', 'S', 'J'][i]}
            </div>
          ))}
        </div>
        <span className="text-sm font-medium text-gray-700">
          <strong className="text-gray-900">{count.toLocaleString()}</strong> creators, brands, and agencies
        </span>
      </div>

      {/* Ticker logos */}
      <div className="relative overflow-hidden py-3 border-y border-gray-100 bg-gray-50/50">
        <div className="ticker-track">
          {[...LOGOS, ...LOGOS].map((logo, i) => (
            <div key={i} className="mx-8 text-sm font-bold text-gray-300 tracking-tight whitespace-nowrap">
              {logo}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
