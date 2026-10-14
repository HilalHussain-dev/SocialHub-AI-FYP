import React from 'react';
import { PricingCards } from './PricingCards';
import { Testimonial } from './Testimonial';
import { FeatureComparison } from './FeatureComparison';
import { FAQ } from './FAQ';

export function PricingPage() {
  return (
    <div className="pt-24 pb-20 font-sans bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-16 pt-10">
        <h1 className="text-4xl sm:text-5xl md:text-[54px] font-extrabold text-gray-900 tracking-tight leading-none">
          Flexible pricing for everyone
        </h1>
      </div>
      
      <PricingCards />
      <Testimonial />
      <FeatureComparison />
      <FAQ />
    </div>
  );
}
