import React from 'react';
import { Globe, Users, Star, TrendingUp, ExternalLink } from 'lucide-react';

const METRICS = [
  { label: 'Monthly Active Users', value: '267,037', icon: Users },
  { label: 'Total Customers', value: '81,462', icon: Star },
  { label: 'Teammates', value: '73', icon: Globe },
  { label: 'Annual Recurring Revenue', value: '$26.6M', icon: TrendingUp },
];

export function Metrics() {
  return (
    <section className="py-20 bg-gray-50 border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-xs font-semibold text-gray-600 mb-8 shadow-sm">
          <Globe className="w-3.5 h-3.5 text-green-500" />
          Live metrics · Updated in real time
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
          We are an open company
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto mb-14 text-lg">
          No smoke and mirrors — we share our revenue, team size, and growth publicly.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {METRICS.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="bg-white rounded-2xl border border-gray-100 p-7 hover:shadow-md transition-shadow">
                <Icon className="w-6 h-6 text-gray-400 mx-auto mb-4" />
                <div className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                  {m.value}
                </div>
                <div className="text-sm text-gray-500 font-medium">{m.label}</div>
              </div>
            );
          })}
        </div>

        <a href="#" className="inline-flex items-center gap-2 mt-10 text-sm font-semibold text-gray-700 border border-gray-200 bg-white px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
          View our open dashboard <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}
