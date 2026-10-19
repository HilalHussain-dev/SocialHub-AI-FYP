import React from 'react';
import {
  FaLinkedinIn,
  FaPinterestP,
  FaYoutube,
  FaXTwitter,
  FaGoogle,
  FaInstagram,
  FaTiktok,
  FaFacebookF
} from 'react-icons/fa6';

import { SiThreads } from 'react-icons/si';

import { connectFacebook } from '../lib/facebook';
import { connectInstagram } from '../lib/instagram';

const CHANNELS = [
  {
    name: 'LinkedIn',
    color: '#0A66C2',
    icon: <FaLinkedinIn className="w-5 h-5 text-white" />
  },
  {
    name: 'Threads',
    color: '#1a1a1a',
    icon: <SiThreads className="w-5 h-5 text-white" />
  },
  {
    name: 'Pinterest',
    color: '#E60023',
    icon: <FaPinterestP className="w-5 h-5 text-white" />
  },
  {
    name: 'YouTube',
    color: '#FF0000',
    icon: <FaYoutube className="w-5 h-5 text-white" />
  },
  {
    name: 'X / Twitter',
    color: '#1a1a1a',
    icon: <FaXTwitter className="w-4 h-4 text-white" />
  },
  {
    name: 'Google Business',
    color: '#4285F4',
    icon: <FaGoogle className="w-4 h-4 text-white" />
  },
  {
    name: 'Instagram',
    color: '#E1306C',
    icon: <FaInstagram className="w-5 h-5 text-white" />
  },
  {
    name: 'TikTok',
    color: '#010101',
    icon: <FaTiktok className="w-4 h-4 text-white" />
  },
  {
    name: 'Facebook',
    color: '#1877F2',
    icon: <FaFacebookF className="w-5 h-5 text-white" />
  }
];

interface ChannelsProps {
  onSelectChannel?: (channelName: string) => void;
}

export function Channels({ onSelectChannel }: ChannelsProps) {
  return (
    <section className="py-20 overflow-hidden">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
          Post everywhere, manage from one place
        </h2>

        <p className="text-gray-500 max-w-xl mx-auto">
          9 platforms and counting — we add new channels as they grow.
        </p>
      </div>

      <div className="relative overflow-hidden -mx-4">

        <div className="channel-track">

          {[...CHANNELS, ...CHANNELS].map((ch, i) => {

            const isFacebook = ch.name === 'Facebook';
            const isInstagram = ch.name === 'Instagram';
            const isInteractive = isFacebook || isInstagram;

            const handleClick = () => {
              if (onSelectChannel) {
                onSelectChannel(ch.name);
              }
            };

            return (
              <div
                key={i}
                onClick={isInteractive ? handleClick : undefined}

                className={`
                  flex items-center gap-3
                  bg-white border border-gray-100
                  rounded-2xl px-5 py-3
                  shadow-sm transition-shadow
                  shrink-0
                  ${isInteractive
                    ? 'cursor-pointer hover:shadow-md'
                    : 'cursor-default hover:shadow-md'
                  }
                `}
              >


                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: ch.color }}
                >
                  {ch.icon}
                </div>

                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                  {ch.name}
                </span>

              </div>
            );
          })}

        </div>

      </div>

    </section>
  );
}