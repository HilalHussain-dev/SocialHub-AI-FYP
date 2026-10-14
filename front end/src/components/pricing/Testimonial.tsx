import React from 'react';
import { FaLinkedinIn, FaPinterestP, FaYoutube, FaXTwitter, FaInstagram, FaMastodon, FaTiktok, FaFacebookF, FaShopify } from 'react-icons/fa6';
import { SiBluesky } from 'react-icons/si';

export function Testimonial() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-24">
      {/* Logos */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-16 bg-[#F3F1EC] py-10 rounded-2xl">
        <span className="text-[22px] font-semibold text-gray-900 md:mr-4 text-center md:text-left leading-tight">
          Connect your<br/>favorite accounts
        </span>
        <div className="flex flex-wrap justify-center gap-2.5 text-white font-bold text-sm">
          <div className="w-10 h-10 rounded-lg bg-[#0A66C2] flex items-center justify-center"><FaLinkedinIn className="w-5 h-5 text-white" /></div>
          <div className="w-10 h-10 rounded-lg bg-[#E60023] flex items-center justify-center"><FaPinterestP className="w-5 h-5 text-white" /></div>
          <div className="w-10 h-10 rounded-lg bg-[#E1306C] flex items-center justify-center"><FaInstagram className="w-5 h-5 text-white" /></div>
          <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center"><FaXTwitter className="w-5 h-5 text-white" /></div>
          <div className="w-10 h-10 rounded-lg bg-[#FF0000] flex items-center justify-center"><FaYoutube className="w-5 h-5 text-white" /></div>
          <div className="w-10 h-10 rounded-lg bg-[#010101] flex items-center justify-center"><FaTiktok className="w-5 h-5 text-white" /></div>
          <div className="w-10 h-10 rounded-lg bg-[#1877F2] flex items-center justify-center"><FaFacebookF className="w-5 h-5 text-white" /></div>
          <div className="w-10 h-10 rounded-lg bg-[#6364FF] flex items-center justify-center"><FaMastodon className="w-5 h-5 text-white" /></div>
          <div className="w-10 h-10 rounded-lg bg-[#95BF47] flex items-center justify-center"><FaShopify className="w-5 h-5 text-white" /></div>
          <div className="w-10 h-10 rounded-lg bg-[#0085FF] flex items-center justify-center"><SiBluesky className="w-5 h-5 text-white" /></div>
        </div>
      </div>

      {/* Testimonial Quote */}
      <div className="bg-[#2C3229] rounded-3xl p-10 md:p-16 text-center text-white relative">
        <p className="text-[26px] md:text-[32px] font-medium leading-snug max-w-4xl mx-auto mb-10 tracking-tight">
          "Buffer's per-channel pricing allows me to be flexible and save money if a client leaves. They're never locked in indefinitely, and I don't want to continue paying for their channel when they're no longer in contract."
        </p>
        <div className="flex items-center justify-center gap-4">
          <div className="w-14 h-14 bg-gray-400 rounded-full overflow-hidden border-2 border-[#2C3229]">
             {/* placeholder avatar */}
             <img src="https://i.pravatar.cc/150?img=47" alt="Alexandrea Bowman" className="w-full h-full object-cover" />
          </div>
          <div className="text-left">
            <div className="font-bold text-[17px]">Alexandrea Bowman</div>
            <div className="text-gray-300 text-sm">Sapphire Social</div>
          </div>
        </div>
      </div>
    </div>
  );
}
