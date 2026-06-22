'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Radio, BarChart3, Wand2, PiggyBank } from 'lucide-react';

const features = [
  {
    number: '01',
    icon: Radio,
    title: 'Unified Campaign Creator',
    description:
      'Build one campaign that launches simultaneously on Meta and Google. Set targeting, budget, and creatives once — we handle the rest.',
  },
  {
    number: '02',
    icon: BarChart3,
    title: 'Aggregated Analytics',
    description:
      'View blended CTR, ROAS, and spend across all platforms in one place. No more spreadsheet-pulling or manual data merging.',
  },
  {
    number: '03',
    icon: Wand2,
    title: 'Cross-Channel Automation',
    description:
      'Set rules that automatically rebalance daily budgets based on real-time ROAS performance across your networks.',
  },
  {
    number: '04',
    icon: PiggyBank,
    title: 'Smarter Budget Allocation',
    description:
      'Stop wasting ad spend. Our engine shifts budget toward top-performing channels so you maximize every dollar.',
  },
];

export default function Features() {
  const featuresRef = useRef<HTMLDivElement>(null);

  return (
    <section ref={featuresRef} id="features" className="py-24 md:py-32 px-6 md:px-12 lg:px-24 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-light text-gray-900 mb-6">
            Everything you need to win
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl font-light">
            Stop platform-hopping. Manage all your ad campaigns from a single, powerful interface.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group"
            >
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <span className="text-[#E55A3C] font-mono text-sm">/{feature.number}</span>
                </div>
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-6 h-6 text-[#E55A3C]" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-medium text-gray-900">{feature.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-20 p-8 md:p-12 rounded-3xl bg-gradient-to-r from-[#FEF3E2] to-[#FFDAB9] relative overflow-hidden"
        >
          <div className="relative z-10">
            <p className="text-lg text-[#E55A3C] font-medium mb-2">Coming Soon</p>
            <h3 className="text-2xl md:text-3xl font-light text-gray-900 mb-4 max-w-3xl">
              TikTok Ads, LinkedIn Ads & Snapchat — all in one place. We&apos;re building the universal ad manager.
            </h3>
            <button className="text-[#E55A3C] font-medium hover:underline inline-flex items-center gap-2">
              Join the waitlist
              <span className="w-6 h-6 rounded-full bg-[#E55A3C] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
