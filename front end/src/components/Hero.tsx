import React, { useState } from 'react';
import { Zap, ArrowRight, Check } from 'lucide-react';
import { Channels } from './Channels';

export function Hero() {
  const [email, setEmail] = useState('');

  return (
    <section className="text-center px-4 pt-16 pb-0 md:pt-24 md:pb-0 max-w-5xl mx-auto">
      {/* Badge */}
      <a href="#" className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 text-xs font-semibold text-gray-700 mb-8 hover:bg-gray-100 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95 transition-all duration-300 group">
        <Zap className="w-3.5 h-3.5 text-amber-500 group-hover:scale-125 transition-transform duration-300" />
        Now with AI-powered scheduling and MCP integration
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
      </a>

      <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.05] mb-6">
        Your SocialHub workspace
      </h1>
      <p className="text-lg md:text-xl text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
        Works with every platform and all your favorite tools.
      </p>

      {/* Email capture */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6 max-w-md mx-auto">
        <input
          type="email"
          placeholder="Your work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full sm:flex-1 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
        />
        <a href="#" className="w-full sm:w-auto shrink-0 bg-[#1a1a1a] text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-black hover:shadow-xl hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-95 active:shadow-md transition-all duration-300 whitespace-nowrap">
          Get started for free
        </a>
      </div>
      <p className="text-xs text-gray-400 mb-12">
        <Check className="w-3.5 h-3.5 inline mr-1 text-green-500" />
        Free forever · No credit card required
      </p>

      {/* Channels track */}
      <Channels />
    </section>
  );
}
