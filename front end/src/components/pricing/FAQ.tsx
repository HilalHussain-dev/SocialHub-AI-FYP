import React from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  "Does Buffer work for agencies or businesses managing multiple brands?",
  "What counts as a channel?",
  "What features are supported for each specific channel?",
  "What are the billing options for Buffer's paid plans?",
  "What payment methods does Buffer accept?",
  "Does Buffer have a free trial?",
  "What happens at the end of the 14-day trial?",
  "Can I keep my three free channels if I upgrade from Buffer's Free plan to a paid plan?",
  "What is the scheduled post limit for each plan?",
  "Does Buffer offer a discount to nonprofit organizations and charities?",
  "Does Buffer charge Value-Added Tax (VAT) to customers?",
  "When were the prices of Buffer's plans last updated?",
  "How does Buffer's new pricing help me save as I grow?"
];

export function FAQ() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-24 border-t border-gray-200">
      <div className="flex flex-col md:flex-row gap-12">
        <h2 className="text-[40px] font-extrabold text-gray-900 w-full md:w-1/3 tracking-tight">FAQs</h2>
        <div className="w-full md:w-2/3 space-y-0">
          {FAQS.map((q, i) => (
            <details key={i} className="group border-b border-gray-200">
              <summary className="flex justify-between items-center font-semibold cursor-pointer list-none text-gray-900 py-6 text-[15px] hover:text-gray-600 transition-colors">
                {q}
                <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="text-gray-600 pb-6 text-[15px] leading-relaxed hidden group-open:block">
                Buffer offers flexible plans to suit different needs. You can manage multiple channels across different social platforms. For detailed billing options or nonprofit discounts, please reach out to our support team or check our detailed guide.
              </p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
