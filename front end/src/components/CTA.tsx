import React from 'react';
import { Check } from 'lucide-react';

export function CTA() {
  return (
    <section className="py-24 md:py-32 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.08] mb-6">
          Grow your social presence<br />with confidence
        </h2>
        <p className="text-gray-500 text-lg mb-10">
          Join 267,037 creators and teams who trust Buffer every day.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
          <input
            type="email"
            placeholder="Your work email"
            className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
          />
          <a href="#" className="w-full sm:w-auto shrink-0 bg-[#1a1a1a] text-white text-sm font-bold px-6 py-3.5 rounded-xl hover:bg-gray-800 transition-colors whitespace-nowrap">
            Get started free
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-green-500" />
          Free forever · No credit card required
        </p>
      </div>
    </section>
  );
}
