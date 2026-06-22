'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Link2, Upload, Rocket, Activity } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Link2,
    title: 'Connect Your Accounts',
    description:
      'Securely link your Meta Business Manager and Google Ads account. We auto-detect your ad accounts, pages, and tracking pixels.',
  },
  {
    number: '02',
    icon: Upload,
    title: 'Upload Your Assets',
    description:
      'Add images and videos to your global asset library. Our validator flags format or size issues before they reach the ad networks.',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Launch Cross-Channel Campaigns',
    description:
      'Fill out one unified form — campaign settings, targeting, and creatives. We assemble and send platform-specific payloads to Meta and Google.',
  },
  {
    number: '04',
    icon: Activity,
    title: 'Monitor & Optimize',
    description:
      'Track blended performance metrics on a live dashboard. Toggle automated budget rules to let AI optimize your spend daily.',
  },
];

export default function Tutorial() {
  const tutorialRef = useRef<HTMLDivElement>(null);

  return (
    <section ref={tutorialRef} id="how-it-works" className="py-24 md:py-32 px-6 md:px-12 lg:px-24 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-[#E55A3C] font-medium text-sm tracking-wider uppercase">
            How It Works
          </span>
          <h2 className="text-4xl md:text-5xl font-light text-gray-900 mt-4 mb-6">
            From setup to go-live in minutes
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            No more jumping between tabs. Create, publish, and optimize cross-channel ads from one place.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-[#E55A3C] font-mono text-sm mb-4">/{step.number}</span>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center mb-6">
                  <step.icon className="w-8 h-8 text-[#E55A3C]" />
                </div>
                <h3 className="text-xl font-medium text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
